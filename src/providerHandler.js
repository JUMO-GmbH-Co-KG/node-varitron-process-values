import { dbusGateway } from './dbusGateway.js';
import { getProcessDataDescriptionBuffer } from './bufferHandler.js';

//buffer for ProcessDataDescription
const ProcessDataDescriptionBuffer = [];

export async function getProcessDataDescription(moduleName, instanceName, objectName, language) {
    //receive processDescription from Buffer
    const processDescriptionBuffer = getProcessDataDescriptionBuffer(moduleName, instanceName, objectName, ProcessDataDescriptionBuffer);

    if (processDescriptionBuffer == undefined) {
        const method = 'getProcessDataDescription';
        const params = [instanceName, language];
        const serviceDescription = {
            serviceName: moduleName,
            objectPath: '/' + objectName,
            interfaceName: 'Interface.ProcessDecription',
            method,
            params,
        };

        const processDescription = dbusGateway(serviceDescription);
        // push received process description to buffer
        ProcessDataDescriptionBuffer.push({
            moduleName,
            instanceName,
            objectName,
            processDescription
        });

        return processDescription;
    } else {
        return processDescriptionBuffer;
    }
}
