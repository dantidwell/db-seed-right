#!/usr/bin/env node
'use strict'

var pg = require('pg');
var Sequelize = require('sequelize');
var queries = require('./queries');

process.env.NODE_ENV = process.env.NODE_ENV || 'development';
console.log(`Using NODE_ENV=${process.env.NODE_ENV}`);

var sqlConfig = require('./read-config')(process.cwd());

//disable sequelize logging
sqlConfig.config.logging = false;

var sequelize = new Sequelize(sqlConfig.config.database, sqlConfig.config.username, sqlConfig.config.password, sqlConfig.config);
var client = new pg.Client(sqlConfig.config);
var queryInterface = sequelize.getQueryInterface();

var commandQueue = []

var buildDepGraph = function(deps) {     
    /* Build a graph of the fk dependencies */
    var graph = {}; //graph data structure
    
    for(var i=0; i<deps.length; i++) { 
        var parent = deps[i].parent_table_name; 
        var child = deps[i].child_table_name;
        
        /* add parent to the adjacency list if needed */
        if(!graph[parent]) { 
            graph[parent] = { 
                seeded: false, //whether or not the table has been seeded
                adjList: []
            }        
        }
        if(child!==null) { 
            graph[parent].adjList.push(child);            
        }
    }
    return graph;
}

var buildCommandQueue = function(node, graph, commandQueue, command) {
    //seed the current node's dependencies 
    for(var i = 0; i < graph[node].adjList.length; i++) {
        var nextNode = graph[node].adjList[i]; 
        buildCommandQueue(nextNode, graph, commandQueue, command);
    }
    //skip if already seeded
    if(graph[node].seeded) {
        return;
    }
    graph[node].seeded = true;
    commandQueue.push(command(node)) 
}

var seed = function(table) { 
    return function() { 
        /*
            try to import seeder
            
            For now, seeder file name convention is dash-delimited table name 
            followed by '-seeder.js', table name in db should be underscore delimited 
        */       

        try {
            var seederPath = `${sqlConfig.seedersPath}/${table.replace(/_/g,'-')}-seeder`;
            var seeder = require(seederPath);    
            if(!seeder || !seeder.up) { 
                throw `${seederPath} is not a valid sequelize seeder`;
            }
            console.log(`Seeding table ${table}`)
            return seeder.up(queryInterface); //return promise    
        } catch(ex) {
            return new Promise(function(resolve,reject) { 
                reject(`No seeder found for table ${table}`);
            })
        }
    }
}

var clean = function(table) { 
    return function() {
        var deleteSql = `DELETE FROM "${table}"`;
        
        //TODO: this is pretty brittle, make more robust
        var resetIdSql = `ALTER SEQUENCE public.${table}_id_seq RESTART;` 
        console.log(`Cleaning table ${table}`);
        return sequelize.query(resetIdSql).then(function() { 
            return sequelize.query(deleteSql);
        });
    }
}
/* 
    run queries synchronously in forward or reverse order by chaining promises
*/

var flushCommandQueue = function(q, d) {
    if(q.length===0) { 
        process.exit(0);
    }
    
    var method = (d==='fwd') ? 'shift' : 'pop'; 
     
    q[method]()().then(function() { 
        flushCommandQueue(q, d);
    }).catch(function(e) {
        console.error(`Warning: ${e}. Upstream commands may fail.`); 
        flushCommandQueue(q, d);
    })
}

/* parse command line args */
if(process.argv.length < 3) { 
    console.error('Please provide a command. Valid commands are seed or clean.')
    process.exit(1);
}

var flushDirection;
var command; 
switch(process.argv[2]) { 
    case 'seed': 
        flushDirection = 'fwd'; 
        command = seed;
        break;
    case 'clean': 
        flushDirection = 'rev';
        command = clean;
        break;
    default: 
        console.error('Please provide a valid command. Valid commands are seed or clean.')
        process.exit(1);  
}

client.connect(function(err) { 
    if(err) { 
        console.log(err);
        return process.exit(1);
    }
    client.query(queries.getTableDependencies(['public']), function(err,result) { 
        if(err) { 
            console.error(err); 
            process.exit(1);
        }
        
        var depGraph = buildDepGraph(result.rows); 
        var nodeArray = Object.keys(depGraph);
        var commandQueue = [];
        for(var i = 0; i<nodeArray.length; i++) {
            var node = nodeArray[i]; 
            buildCommandQueue(node, depGraph, commandQueue, command);        
        }
        flushCommandQueue(commandQueue, flushDirection);
    });
})


