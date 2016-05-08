var path = require('path');

var supportedConfigPath = 'config.json';

module.exports = function(rootPath) {
    var configPath;
    var seedersPath;
    try { 
        var configModule = require(path.join(rootPath, '.sequelizerc')); 
        configPath = configModule['config']; 
        seedersPath = configModule['seeders-path'];
    } catch(err) { 
        console.error('No .sequelizerc found in your current working directory.');
        throw(err);
    }
    
    /* 
        grab the config for the current node-env
    */
    var configModule = require(configPath);
    var env = process.env.NODE_ENV || 'development';
    var config = configModule[env];
        
    if(!config) { 
        throw `No configuration found for environment ${env} in ${supportedConfigPath}`;
    } 
    
    return { 
        config:config,
        seedersPath:seedersPath
    }
}