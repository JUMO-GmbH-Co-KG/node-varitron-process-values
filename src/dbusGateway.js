import dbus from '@homebridge/dbus-native';
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
    const description = Object.assign({}, defaultServiceDescription, serviceDescription);
    const bus = getBus();

    try {
        // Obtain a D-Bus interface via callback-based API, wrapped in a Promise.
        const iface = await new Promise((resolve, reject) => {
            bus.getService(description.servicePrefix + description.serviceName)
                .getInterface(description.objectPath, description.interfaceName, (err, iface) => {
                    if (err) {
                        reject(new Error(err.message || String(err)));
                    } else {
                        resolve(iface);
                    }
                });
        });

        // Check if the interface exists
        if (!iface) {
            throw new Error(
                `No interface found ${description.interfaceName} at ${description.objectPath}`
            );
        }

        // Check if the method exists
        if (!description.method || description.method.length === 0) {
            throw new Error(
                `No method specified in call to ${description.servicePrefix + description.serviceName}, ${description.objectPath}, ${description.interfaceName}`
            );
        }

        // Check if the method is a function
        if (typeof iface[description.method] !== 'function') {
            throw new Error(
                `No function '${description.method}' in ${description.servicePrefix + description.serviceName}, ${description.objectPath}, ${description.interfaceName}`
            );
        }

        // Invoke the specified D-Bus method with the provided parameters, wrapped in a Promise.
        const response = await new Promise((resolve, reject) => {
            iface[description.method](...description.params, (err, response) => {
                if (err) {
                    reject(new Error(`Error calling function '${description.method}' in ${description.servicePrefix + description.serviceName}, ${description.objectPath}, ${description.interfaceName}: ${err.message}`));
                } else {
                    resolve(response);
                }
            });
        });

        bus.connection.end();
        staticDBusReference = null;
        return parse(response);
    } catch (err) {
        throw new Error(
            `Selector not found. ${err.message} @ ${description.servicePrefix + description.serviceName}, ${description.objectPath}, ${description.interfaceName}, ${description.method}(${description.params})`
        );
    }
}

