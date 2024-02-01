import dbus from '@quadratclown/dbus-next';
import { parse } from './dbusReply.js';

const dBusServicePrefix = 'de.jupiter.';

let staticDBusReference;
/**
 * Retrieves and returns a reference to the D-Bus instance (system or session bus) based on the current platform.
 *
 * @returns {Object} - The D-Bus instance reference (either system bus for device or session bus for desktop).
 *
 * @description
 * This function checks if a static D-Bus reference exists and, if not, determines the appropriate bus based on the
 * current platform architecture. It initializes and caches the reference for subsequent calls. The system bus is used
 * for devices (ARM architecture), and the session bus is used for desktop environments. The cached reference is returned.
 *
 * @example
 * // Example usage:
 * const dbusInstance = getBus();
 * // Use the dbusInstance for D-Bus communication...
 */
function getBus() {
    // Check if a static D-Bus reference exists.
    if (!staticDBusReference) {
        // Determine the appropriate bus based on the current platform architecture.
        if (process.arch === 'arm') {
            staticDBusReference = dbus.systemBus();
        } else {
            staticDBusReference = dbus.sessionBus();
        }
    }
    // Return the cached D-Bus instance reference.
    return staticDBusReference;
}

const defaultServiceDescription = Object.freeze({
    servicePrefix: dBusServicePrefix,
    serviceName: '',
    objectPath: '',
    interfaceName: '',
    method: '',
    params: [],
});
/**
 * Invokes a D-Bus method based on the provided service description and returns the parsed response.
 *
 * @param {Object} serviceDescription - The description object containing information about the D-Bus service, object, and method.
 * @returns {Promise<Object>} - A promise that resolves with the parsed response from the D-Bus method invocation.
 * @throws {Error} - Throws an error if the method is not found or if there are issues with D-Bus communication.
 *
 * @description
 * This function acts as a gateway for invoking D-Bus methods. It constructs a D-Bus proxy object based on the provided
 * service description, validates the existence of the specified method, invokes the method with the provided parameters,
 * disconnects from the D-Bus, and returns the parsed response. If any issues occur during this process, appropriate error
 * messages are generated and thrown.
 *
 * @example
 * // Example usage:
 * const serviceDescription = {
 *     serviceName: 'ExampleService',
 *     objectPath: '/exampleObject',
 *     interfaceName: 'Interface.ExampleInterface',
 *     method: 'performAction',
 *     params: ['param1', 'param2']
 * };
 * try {
 *     const response = await dbusGateway(serviceDescription);
 *     // Process the parsed response...
 * } catch (error) {
 *     // Handle the error...
 * }
 */
export async function dbusGateway(serviceDescription) {
    // Merge the provided service description with default values.
    const description = Object.assign({}, defaultServiceDescription, serviceDescription);

    // Retrieve the D-Bus instance reference.
    const bus = getBus();

    try {
        // Obtain a D-Bus proxy object based on the service description.
        const obj = await bus.getProxyObject(description.servicePrefix + description.serviceName, description.objectPath);
        const iface = obj.getInterface(description.interfaceName);

        // Check if the specified method is a function.
        if (typeof iface[description.method] !== 'function') {
            const err = new Error(
                `No function '${description.method}' in ${description.servicePrefix + description.serviceName}, ${description.objectPath}, ${description.interfaceName}`
            );
            return Promise.reject(err);
        }

        // Invoke the specified D-Bus method with the provided parameters.
        const response = await iface[description.method](...description.params);

        // Disconnect from the D-Bus and reset the static D-Bus reference.
        bus.disconnect();
        staticDBusReference = null;

        // Resolve the promise with the parsed response.
        return Promise.resolve(parse(response));
    } catch (err) {
        // Generate an error message for issues during D-Bus method invocation.
        const errMsg = `selector not found. ${err.message} @ ${description.servicePrefix + description.serviceName}, ${description.objectPath}, ${description.interfaceName}, ${description.method}(${description.params})`;
        return Promise.reject(errMsg);
    }
}
