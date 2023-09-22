
import { dbusGateway } from './dbusGateway.js';

export async function systemInformationManager(method, params) {
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

export async function getRegisteredProvidersList(language, providerType) {
    const method = 'getRegisteredProvidersList';
    const params = [providerType, language];

    try {
        return await systemInformationManager(method, params);
    } catch (err) {
        throw err;
    }
};

export async function getListOfInstances(modulename, language) {
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

export async function getProcessDataDescription(modulename, instancename, language) {
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
