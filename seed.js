'use strict'

var pg = require('pg');
var queries = require('./queries');

process.env.NODE_ENV = process.env.NODE_ENV || 'development';
console.log(`Using NODE_ENV=${process.env.NODE_ENV}`);

var config = require('./read-config')(process.cwd());

var client = new pg.Client(config);

client.connect(function(err) { 
    if(err) { 
        console.log(err);
        return process.exit(1);
    }
    client.query(queries.getTableDependencies(['public']), depCb);
})

var depCb = function(err,result) { 
    if(err) { 
        console.log(err);
        process.exit(1);
    }
    
    /* 
        Build a graph of the fk dependencies
    */
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
    
    console.log(graph);
    
    var nodeArray = Object.keys(graph);
    for(var i = 0; i<nodeArray.length; i++) {
        var node = nodeArray[i]; 
        seed(node, graph);        
    } 
}

var seed = function(node, graph) { 
    for(var i = 0; i < graph[node].adjList.length; i++) {
        var nextNode = graph[node].adjList[i]; 
        seed(nextNode, graph);
    }
    
    /* 
        Base case - seed this table
    */
    if(!graph[node].seeded) { 
        graph[node].seeded = true;
        console.log(`Seeding ${node}`);        
    }
}
