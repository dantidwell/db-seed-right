var getTableDependencies = function(schemas) { 
    var schemasDelimited = '';
    for(var i=0; i<schemas.length; i++) { 
        schemasDelimited += `'${schemas[i]}'`;
        if(i<schemas.length-1) { 
            schemasDelimited += ',';
        }
    }
    
    return `
        SELECT
            tbls.table_schema AS parent_table_schema, 
            tbls.table_name AS parent_table_name,
            tblsc.child_table_schema, 
            tblsc.child_table_name 
        FROM
            INFORMATION_SCHEMA.tables tbls
            
            LEFT JOIN ( 
                SELECT
                    tc.table_schema AS parent_table_schema,  
                    tc.table_name AS parent_table_name, 
                    ctu.table_schema AS child_table_schema, 
                    ctu.table_name AS child_table_name
                FROM 
                    INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
                    
                    INNER JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
                    ON tc.constraint_name = rc.constraint_name
                    
                    INNER JOIN INFORMATION_SCHEMA.CONSTRAINT_TABLE_USAGE ctu 
                    ON rc.constraint_name = ctu.constraint_name     
            ) tblsc
            
            ON tbls.table_schema = tblsc.parent_table_schema AND tbls.table_name = tblsc.parent_table_name
            
        WHERE 
            tbls.table_schema IN (${schemasDelimited})
` 
}

module.exports = { 
    getTableDependencies:getTableDependencies
}
