import { dbusGateway } from './dbusGateway.js';

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
}
