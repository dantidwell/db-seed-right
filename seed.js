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
    var graph = []; //graph adjacency list
    var metadata = {}; //graph node metadata
    
    for(var i=0; i<result.rows.length; i++) { 
        var parent = result.rows[i].parent_table_name; 
        var child = result.rows[i].child_table_name;
        
        /* add parent to the adjacency list if needed */
        if(!metadata[parent]) { 
            metadata[parent] = { 
                idx: graph.length, //index in the adjacency list
                seeded: false //whether or not the table has been seeded
            }
            graph.push([]);        
        }
        graph[metadata[parent].idx].push(child);
    }
    seed(graph, metadata); 
}

var seed = function(graph, metadata) { 
    
}
