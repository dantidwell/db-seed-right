var path = require('path');

var supportedConfigPath = 'config.json';

module.exports = function(rootPath) {
    var configPath = path.join(rootPath, supportedConfigPath); 
    var configModule = require(configPath);
    if(!configModule) { 
        throw `No config.json file found at ${supportedConfigPath}`;
    }
    
    var env = process.env.NODE_ENV || 'development';
    var config = configModule[env];
    
    if(!config) { 
        throw `No configuration found for environment ${env} in ${supportedConfigPath}`;
    } else { 
        return config;
    }
}