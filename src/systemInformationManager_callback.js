'use strict';

const dbusGateway = require('./dbusGateway.js');

const systemInformationManager = function (method, params, callback) {
    const serviceDescription = {
        serviceName: 'SystemInformationManager',
        objectPath: '/Information',
        interfaceName: 'Interface.SystemInformationManager',
        method,
        params,
    };
    dbusGateway(serviceDescription, callback);
};

const getRegisteredProvidersList = function (language, providerType, callback) {
    const method = 'getRegisteredProvidersList';
    const params = [providerType, language];

    systemInformationManager(method, params, (err, providingModules) => {
        if (err) {
            return callback(err);
        }
        callback(null, providingModules);
    });
};

const getListOfInstances = function (modulename, language, callback) {
    const method = 'getListOfInstances';
    const params = ['node-red', language];
    const serviceDescription = {
        serviceName: modulename,
        objectPath: '/ProcessData',
        interfaceName: 'Interface.ProcessDecription',
        method,
        params,
    };
    dbusGateway(serviceDescription, callback);
}

const getProcessDataDescription = function (modulename, instancename, language, callback) {
    const method = "getProcessDataDescription";
    const params = [instancename, language];
    const serviceDescription = {
        //@todo fertig schreiben
        serviceName: modulename,
        objectPath: '/ProcessData',
        interfaceName: 'Interface.ProcessDecription',
        method,
        params,
    };
    dbusGateway(serviceDescription, callback);
}


module.exports = {
    getRegisteredProvidersList,
    getListOfInstances,
    getProcessDataDescription,
};
