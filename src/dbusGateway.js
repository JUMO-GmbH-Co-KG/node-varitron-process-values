
//const dbus = require('dbus-next');
import dbus from 'dbus-next';
import { parse } from './dbusReply.js';

const dBusServicePrefix = 'de.jupiter.';
const defaultDBusName = 'session';
//const dBusTimeout = 120 * 1000;

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
};

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
            throw new Error(
                `No function '${description.method}' in ${description.servicePrefix + description.serviceName}, ${description.objectPath}, ${description.interfaceName}`
            );
        }

        const response = await iface[description.method](...description.params);
        return await parse(response);
    } catch (err) {
        err += ` @ ${description.servicePrefix + description.serviceName}, ${description.objectPath}, ${description.interfaceName}, ${description.method}(${description.params})`;
        throw err;
    }
};

const defaultSignalDescription = Object.freeze({
    servicePrefix: dBusServicePrefix,
    serviceName: '',
    objectPath: '',
    interfaceName: '',
    signal: '',
});

export async function attachSignal(signalDescription) {
    const description = Object.assign({}, defaultSignalDescription, signalDescription);

    const bus = getBus();

    try {
        const obj = await bus.getProxyObject(description.servicePrefix + description.serviceName, description.objectPath);
        const iface = obj.getInterface(description.interfaceName);

        iface.on(description.signal, eventhandler);
    } catch (err) {
        err += ` @ ${description.servicePrefix + description.serviceName}, ${description.objectPath}, ${description.interfaceName}, ${description.method}(${description.params})`;
        throw err;
    }
};

export async function detachSignal(signalDescription) {
    const description = Object.assign({}, defaultSignalDescription, signalDescription);

    const bus = getBus();

    try {
        const obj = await bus.getProxyObject(description.servicePrefix + description.serviceName, description.objectPath);
        const iface = obj.getInterface(description.interfaceName);

        iface.removeListener(description.signal, eventhandler);
    } catch (err) {
        err += ` @ ${description.servicePrefix + description.serviceName}, ${description.objectPath}, ${description.interfaceName}, ${description.method}(${description.params})`;
        throw err;
    }
};
