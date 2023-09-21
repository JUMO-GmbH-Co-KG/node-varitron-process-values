'use strict';

const dbus = require('dbus-next');
const dbusReply = require('./dbusReply.js');

const dBusServicePrefix = 'de.jupiter.';
const defaultDBusName = 'session';
//const dBusTimeout = 120 * 1000;

let staticDBusReference = null;
const getBus = function () {
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

const callMethod = function (serviceDescription, callback) {
    callMethodNative(serviceDescription, (err, result) => {
        if (err) return callback(err);
        dbusReply.parse(result, callback);
    });
};

const callMethodNative = function (serviceDescription, callback) {
    const description = Object.assign({}, defaultServiceDescription, serviceDescription);

    const bus = getBus();
    bus.getProxyObject(description.servicePrefix + description.serviceName, description.objectPath).then((obj) => {
        const iface = obj.getInterface(description.interfaceName);

        if (typeof iface[description.method] !== 'function') {
            return callback(
                new Error(
                    `No function '${description.method}' in ${description.servicePrefix + description.serviceName}, ${description.objectPath
                    }, ${description.interfaceName}`
                )
            );
        }
        // const options = {
        //     timeout: dBusTimeout,
        // };
        iface[description.method](...description.params).then((response) => {
            callback(null, response);
        }).catch((err) => {
            return callback(
                new Error(
                    `Error calling function '${description.method}' in ${description.servicePrefix + description.serviceName}, ${description.objectPath
                    }, ${description.interfaceName}: ${err.message}`
                )
            );
        });
    }).catch((err) => {
        err.message += ` @ ${description.servicePrefix + description.serviceName}, ${description.objectPath}, ${description.interfaceName}, ${description.method}(${description.params})`;
        return callback(err);
    });
};

const defaultSignalDescription = Object.freeze({
    servicePrefix: dBusServicePrefix,
    serviceName: '',
    objectPath: '',
    interfaceName: '',
    signal: '',
});

const attachSignal = function (signalDescription, eventhandler, callback) {
    if (!callback) {
        callback = () => { };
    }
    const description = Object.assign({}, defaultSignalDescription, signalDescription);

    const bus = getBus();
    bus.getProxyObject(description.servicePrefix + description.serviceName, description.objectPath).then((obj) => {
        const iface = obj.getInterface(description.interfaceName);

        iface.on(description.signal, eventhandler);
        return callback(null);
    }).catch((err) => {
        err.message += ` @ ${description.servicePrefix + description.serviceName}, ${description.objectPath}, ${description.interfaceName}, ${description.method}(${description.params})`;
        return callback(err);
    });

    // bus.getInterface(description.servicePrefix + description.serviceName, description.objectPath, description.interfaceName, (err, iface) => {
    //     if (err) {
    //         return callback(err);
    //     }
    //     iface.on(description.signal, eventhandler);
    //     return callback(null);
    // });
};

const detachSignal = function (signalDescription, eventhandler, callback) {
    if (!callback) {
        callback = () => { };
    }
    const description = Object.assign({}, defaultSignalDescription, signalDescription);

    const bus = getBus();
    bus.getProxyObject(description.servicePrefix + description.serviceName, description.objectPath).then((obj) => {
        const iface = obj.getInterface(description.interfaceName);

        iface.removeListener(description.signal, eventhandler);
        return callback(null);
    }).catch((err) => {
        err.message += ` @ ${description.servicePrefix + description.serviceName}, ${description.objectPath}, ${description.interfaceName}, ${description.method}(${description.params})`;
        return callback(err);
    });
};

module.exports = callMethod;
module.exports.callMethodNative = callMethodNative;
module.exports.attachSignal = attachSignal;
module.exports.detachSignal = detachSignal;
