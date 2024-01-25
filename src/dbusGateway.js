import dbus from '@quadratclown/dbus-next';
import { parse } from './dbusReply.js';

const dBusServicePrefix = 'de.jupiter.';

let staticDBusReference;

function getBus() {
    if (!staticDBusReference) {
        // use the system bus for device and session bus for desktop
        if (process.arch === 'arm') {
            staticDBusReference = dbus.systemBus();
        } else {
            staticDBusReference = dbus.sessionBus();
        }
    }
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

export async function dbusGateway(serviceDescription) {
    const description = Object.assign({}, defaultServiceDescription, serviceDescription);
    const bus = getBus();

    try {
        const obj = await bus.getProxyObject(description.servicePrefix + description.serviceName, description.objectPath);
        const iface = obj.getInterface(description.interfaceName);

        if (typeof iface[description.method] !== 'function') {
            const err = new Error(
                `No function '${description.method}' in ${description.servicePrefix + description.serviceName}, ${description.objectPath}, ${description.interfaceName}`
            );
            return Promise.reject(err);
        }

        const response = await iface[description.method](...description.params);
        bus.disconnect();
        staticDBusReference = null;
        return Promise.resolve(parse(response));
    } catch (err) {
        const errMsg = `selector not found. ${err.message} @ ${description.servicePrefix + description.serviceName}, ${description.objectPath}, ${description.interfaceName}, ${description.method}(${description.params})`;
        return Promise.reject(errMsg);
    }
}
