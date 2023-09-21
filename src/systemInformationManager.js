'use strict';

const dbusGateway = require('./dbusGateway.js');

const systemInformationManager = async function (method, params) {
    const serviceDescription = {
        serviceName: 'SystemInformationManager',
        objectPath: '/Information',
        interfaceName: 'Interface.SystemInformationManager',
        method,
        params,
    };
    try {
        return await dbusGateway(serviceDescription);
    } catch (err) {
        throw err;
    }
};

const getRegisteredProvidersList = async function (language, providerType) {
    const method = 'getRegisteredProvidersList';
    const params = [providerType, language];

    try {
        return await systemInformationManager(method, params);
    } catch (err) {
        throw err;
    }
};

const getListOfInstances = async function (modulename, language) {
    const method = 'getListOfInstances';
    const params = ['node-red', language];
    const serviceDescription = {
        serviceName: modulename,
        objectPath: '/ProcessData',
        interfaceName: 'Interface.ProcessDecription',
        method,
        params,
    };

    try {
        return await dbusGateway(serviceDescription);
    } catch (err) {
        throw err;
    }
};

const getProcessDataDescription = async function (modulename, instancename, language) {
    const method = 'getProcessDataDescription';
    const params = [instancename, language];
    const serviceDescription = {
        serviceName: modulename,
        objectPath: '/ProcessData',
        interfaceName: 'Interface.ProcessDecription',
        method,
        params,
    };

    try {
        return await dbusGateway(serviceDescription);
    } catch (err) {
        throw err;
    }
};

module.exports = {
    getRegisteredProvidersList,
    getListOfInstances,
    getProcessDataDescription,
};
