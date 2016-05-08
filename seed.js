'use strict'

var pg = require('pg');
var Sequelize = require('sequelize');
var queries = require('./queries');

process.env.NODE_ENV = process.env.NODE_ENV || 'development';
console.log(`Using NODE_ENV=${process.env.NODE_ENV}`);

var sqlConfig = require('./read-config')(process.cwd());

var sequelize = new Sequelize(sqlConfig.config.database, sqlConfig.config.username, sqlConfig.config.password, sqlConfig.config);
var client = new pg.Client(sqlConfig.config);
var queryInterface = sequelize.getQueryInterface();

client.connect(function(err) { 
    if(err) { 
        console.log(err);
        return process.exit(1);
    }
    client.query(queries.getTableDependencies(['public']), depCb);
})

var queryQueue = []

var depCb = function(err,result) { 
    if(err) { 
        console.log(err);
        process.exit(1);
    }
    
    /* Build a graph of the fk dependencies */
    var graph = {}; //graph data structure
    
    for(var i=0; i<result.rows.length; i++) { 
        var parent = result.rows[i].parent_table_name; 
        var child = result.rows[i].child_table_name;
        
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
    var nodeArray = Object.keys(graph);
    for(var i = 0; i<nodeArray.length; i++) {
        var node = nodeArray[i]; 
        buildQueryQueue(node, graph);        
    }
    flushQueryQueue(queryQueue);
}

var buildQueryQueue = function(node, graph) {
    //seed the current node's dependencies 
    for(var i = 0; i < graph[node].adjList.length; i++) {
        var nextNode = graph[node].adjList[i]; 
        buildQueryQueue(nextNode, graph);
    }
    //skip if already seeded
    if(graph[node].seeded) {
        return;
    }
    //try to import seeder, push seeder onto query queue if successful
    var seederName = node.replace('_', '-');
    try { 
        var seeder = require(`${sqlConfig.seedersPath}/${seederName}-seeder`)
        graph[node].seeded = true;
        seeder.up && queryQueue.push(seeder.up);
    } catch(ex) { 
        console.error(`No seeder found for table ${node}`);
    }
}

var flushQueryQueue = function(q) {
    if(q.length===0) { 
        process.exit(0);
    }
     
    q.shift()(queryInterface).then( function() { 
        flushQueryQueue(q);
    })
}

