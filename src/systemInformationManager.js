
import { dbusGateway } from './dbusGateway.js';

export async function systemInformationManager(method, params) {
    const serviceDescription = {
        serviceName: 'SystemInformationManager',
        objectPath: '/Information',
        interfaceName: 'Interface.SystemInformationManager',
        method,
        params,
    };
    return dbusGateway(serviceDescription);
};

export async function getRegisteredProvidersList(language, providerType) {
    const method = 'getRegisteredProvidersList';
    const params = [providerType, language];

    return systemInformationManager(method, params);
};

export async function getListOfInstances(moduleName, objectName, language) {
    const method = 'getListOfInstances';
    const params = ['node-red', language];
    const serviceDescription = {
        serviceName: moduleName,
        objectPath: '/' + objectName,
        interfaceName: 'Interface.ProcessDecription',
        method,
        params,
    };

    return dbusGateway(serviceDescription);
};

export async function getProcessDataDescription(moduleName, instanceName, objectName, language) {
    const method = 'getProcessDataDescription';
    const params = [instanceName, language];
    const serviceDescription = {
        serviceName: moduleName,
        objectPath: '/' + objectName,
        interfaceName: 'Interface.ProcessDecription',
        method,
        params,
    };

    return dbusGateway(serviceDescription);
};
