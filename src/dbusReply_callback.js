'use strict';

const formatData = function (data) {
    if (data === undefined || data === null || data.length === 0) {
        // set data to empty array, if dbus reply is empty
        return [];
    }
    if (typeof data === 'string') {
        if (data.match(/^\s*(\{.*\}|\[.*\])\s*$/gs)) {
            // return string as parsed object or array if it starts with { or [
            return JSON.parse(data);
        }
    }
    if (typeof data === 'object') {
        // return objects and arrays as they are
        return data;
    }
    // return all other stuff as it is, wrapped in an array
    // this is because we want an valid json object every time
    return [data];
};

const parse = function (result, callback) {
    if (result && result.value) {
        try {
            // schema of the jupiter dbus response
            // result.value = [ errCode, errText, <data> ]
            // if errCode === 0 then data is filled
            // if (result.value.length !== 3) throw new Error(`D-Bus response length is ${result.length} instead of 3.`); // @todo uncomment this for EWJUPITER-2626
            const errorCode = result.value[0].value;
            if (errorCode !== 0) {
                const errorText = result.value[1].value;
                return process.nextTick(() => {
                    callback(new Error(`${errorCode}: ${errorText}`));
                });
            }
            return callback(null, formatData(result.value[2].value));
        } catch (e) {
            return callback(e);
        }
    }
    return callback();
};

module.exports.parse = parse;
