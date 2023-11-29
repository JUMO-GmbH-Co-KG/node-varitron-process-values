import dbus from '@quadratclown/dbus-next';
import { parse } from './dbusReply.js';

const dBusServicePrefix = 'de.jupiter.';
const defaultDBusName = 'system';

let staticDBusReference;

function getBus() {
    if (!staticDBusReference) {
        const dBusName = (() => {
            const envDBusName = process.env.DBUS_USE;
            if (envDBusName !== 'system' && envDBusName !== 'session') {
                return defaultDBusName;
            }
            return envDBusName;
        })();
        if (dBusName === 'system') {
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
        const errMsg = err.message + ` @ ${description.servicePrefix + description.serviceName}, ${description.objectPath}, ${description.interfaceName}, ${description.method}(${description.params})`;
        return Promise.reject(errMsg);
    }
}
