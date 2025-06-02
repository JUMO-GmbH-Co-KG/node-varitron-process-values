import { dbusGateway } from './dbusGateway.js';

/**
 * Invokes the System Information Manager D-Bus service with the specified method and parameters.
 *
 * @param {string} method - The method to be called on the System Information Manager D-Bus service.
 * @param {Array} params - An array of parameters to be passed to the D-Bus service method.
 * @returns {Promise<any>} - A promise that resolves with the result of the D-Bus service invocation.
 * @throws {Error} - Throws an error if there's an issue with the D-Bus communication or if the request fails.
 */
async function systemInformationManager(method, params) {
    // Construct the D-Bus service description for the System Information Manager.
    const serviceDescription = {
        serviceName: 'SystemInformationManager',
        objectPath: '/Information',
        interfaceName: 'Interface.SystemInformationManager',
        method,
        params,
    };
    // Invoke the D-Bus gateway with the constructed service description.
    return dbusGateway(serviceDescription);
}

/**
 * Retrieves a list of registered providers based on the specified language and provider type.
 *
 * @param {string} language - The language code specifying the desired language for the providers' information.
 * @param {string} providerType - The type of providers to retrieve (e.g., 'ProcessData', etc.).
 * @returns {Promise<Array>} - A promise that resolves to an array containing the registered providers' information.
 * @throws {Error} - Throws an error if there's an issue with the system information retrieval or if the request fails.
 */
export async function getRegisteredProvidersList(language, providerType) {
    // Define the method and parameters for retrieving the list of registered providers.
    const method = 'getRegisteredProvidersList';
    const params = [providerType, language];
    // Invoke the system information manager with the specified method and parameters.
    return systemInformationManager(method, params);
}

/**
 * Retrieves a list of instances for a specified module and object using D-Bus communication.
 *
 * @param {string} moduleName - The name of the D-Bus service representing the module.
 * @param {string} objectName - The name of the D-Bus object path representing the object.
 * @param {string} language - The language code specifying the desired language for the instances.
 * @returns {Promise<Array>} - A promise that resolves to an array containing the list of instances.
 * @throws {Error} - Throws an error if there's an issue with the D-Bus communication or if the request fails.
 */
export async function getListOfInstances(moduleName, objectName, language) {
    // Define the D-Bus method and parameters for retrieving instances.
    const method = 'getListOfInstances';
    const params = ['node-red', language];
    // Construct the D-Bus service description.
    const serviceDescription = {
        serviceName: moduleName,
        objectPath: '/' + objectName,
        interfaceName: 'Interface.ProcessDecription',
        method,
        params,
    };
    // Invoke the D-Bus gateway with the constructed service description.
    return dbusGateway(serviceDescription);
}
