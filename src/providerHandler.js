import { dbusGateway } from './dbusGateway.js';
import { getProcessDataDescriptionBuffer } from './bufferHandler.js';
import { getObjectFromUrl } from './processValueUrl.js';

//buffer for ProcessDataDescription
const ProcessDataDescriptionBuffer = [];

/**
 * Retrieves the process data description for a specified module, instance, and object.
 *
 * @param {string} moduleName - The name of the D-Bus service representing the module.
 * @param {string} instanceName - The name of the instance associated with the process data.
 * @param {string} objectName - The name of the D-Bus object path representing the object.
 * @param {string} language - The language code specifying the desired language for the process description.
 * @returns {Promise<Object>} - A promise that resolves with the process data description.
 * @throws {Error} - Throws an error if there's an issue with D-Bus communication or if the request fails.
 */
export async function getProcessDataDescription(moduleName, instanceName, objectName, language) {
    // Receive processDescription from Buffer, if available.
    const processDescriptionBuffer = getProcessDataDescriptionBuffer(moduleName, instanceName, objectName, ProcessDataDescriptionBuffer);

    // If the processDescriptionBuffer is undefined, fetch it from D-Bus and update the Buffer.
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

        // Invoke the D-Bus gateway to get the process description.
        const processDescription = dbusGateway(serviceDescription);

        // Push the received process description to the buffer.
        ProcessDataDescriptionBuffer.push({
            moduleName,
            instanceName,
            objectName,
            processDescription
        });

        // Return the fetched process description.
        return processDescription;
    } else {
        // Return the cached process description from the buffer.
        return processDescriptionBuffer;
    }
}

/**
 * Retrieves the process data description based on the given selector.
 * 
 * @param {string} selector - The selector used to retrieve the process data description.
 * @returns {Promise<Object>} - A promise that resolves to the process data description.
 */
export async function getProcessDataDescriptionBySelector(selector) {
    const selectorDescription = getObjectFromUrl(selector);
    return await getProcessDataDescription(
        selectorDescription.moduleName,
        selectorDescription.instanceName,
        selectorDescription.objectName,
        'us_EN'
    );
}
