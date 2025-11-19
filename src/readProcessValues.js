import { attachToSharedMemory, getBufferType, getCurrentBufferStartAddress } from './bufferHandler.js';
import { getNestedProcessValueDescription, getObjectFromUrl } from './processValueUrl.js';
import { getProcessDataDescriptionBySelector } from './providerHandler.js';

/**
 * Reads process values from the given input.
 * For each item in the input, it tries to read the process value using the selector.
 * If an error occurs while reading a process value, it rejects the promise with an error message.
 *
 * @param {Array|String} input - The selector as string or an array of strings to read process values from.
 * @returns {Promise<Array|Object>} - A promise that resolves with the read process values and their properties.
 * @throws {Error} - If an error occurs while reading a process value.
 */
export async function read(input) {
    // wrap a single object in an array to work with the same code underneath
    if (!Array.isArray(input)) {
        input = [input];
    }

    const results = [];
    for (const item of input) {
        try {
            const selector = (typeof item === 'string') ? item : item.selector;
            const result = await readValue(selector);
            results.push(result);
        } catch (e) {
            return Promise.reject(`Can't read process value of ${item.selector || item}: ${e}`);
        }
    }

    // return a single object if input was a single object
    if (results.length === 1) {
        return Promise.resolve(results[0]);
    }
    return Promise.resolve(results);
}

function validateSelector(selector) {
    if (typeof selector !== 'string') {
        throw new Error('selector is not a string');
    }
}

/**
 * Reads data from a specified URL and retrieves information from the System based on the provided selector.
 *
 * @param {string} selector - The URL selector containing information for data retrieval.
 * @returns {Promise<Object>} - A promise that resolves with an object containing information read from the specified URL.
 * @throws {Error} - Throws an error if there's an issue with input validation, D-Bus communication, or shared memory operations.
 */
async function readValue(selector) {
    validateSelector(selector);

    // get process description via dbus
    const processDescription = await getProcessDataDescriptionBySelector(selector);
    const selectorDescription = getObjectFromUrl(selector);
    const valueDescription = getNestedProcessValueDescription(processDescription, selectorDescription.parameterUrl);
    //console.log(`valueDescription: ${JSON.stringify(valueDescription, null, 2)}`);

    // attach to shared memory and read the content
    const memory = attachToSharedMemory(processDescription);
    const dataBuffer = memory.buffer;

    // read value based on type and description
    const bufferStartAddress = getCurrentBufferStartAddress(processDescription, dataBuffer);
    const value = await readValueBasedOnBufferType(processDescription, dataBuffer, bufferStartAddress, valueDescription);

    // read error code from metadata
    const errorCode = getErrorCodeFromMetaData(valueDescription, dataBuffer, bufferStartAddress, value);
    const errorText = getErrorText(errorCode);

    //console.log(`readValue() ${value}${errorCode ? ', ' + errorCode + ': ' + errorText : ', no ErrorObject'}`);

    // until now only one measurement range is supported
    const measurementRangeIndex = 0;
    const measurementRange = valueDescription.measurementRangeAttributes?.[measurementRangeIndex];
    // use POSIX language for unit because this is always available
    const unit = measurementRange?.unitText?.POSIX || '';

    return {
        selector,
        value,
        type: valueDescription.type,
        readOnly: valueDescription.readOnly,
        unit,
        error: {
            code: errorCode,
            text: errorText
        }
    };
}

/**
 * Extracts the error code from metadata based on the provided value description and shared memory buffer.
 *
 * @param {Object} valueDescription - The description of the process value containing metadata details.
 * @param {Buffer} buf - The shared memory buffer containing process data.
 * @param {number} bufferStartAddress - The offset inside the shared memory buffer.
 * @param {number} value - The actual value extracted from the shared memory buffer.
 * @returns {number | null} - The extracted error code or null if no error code is found.
 */
function getErrorCodeFromMetaData(valueDescription, buf, bufferStartAddress, value) {
    // Calculate the offset for metadata within the shared memory buffer.
    const offsetMetadata = valueDescription.offsetSharedMemory + valueDescription.relativeOffsetMetadata;

    let metadata;
    if (valueDescription.sizeMetadata == 4) {
        // Standard case: metadata containing a 32-bit error code.
        metadata = buf.readUInt32LE(offsetMetadata + bufferStartAddress);
    } else if (valueDescription.sizeMetadata == 0) {
        // Case where metadata contains no error code.
        // For legacy JUMO devices/modules, extract error code from the value itself.
        if (valueDescription.type == 'Double') {
            metadata = getErrorCodeFromDoubleValue(value);
        } else if (valueDescription.type == 'Float') {
            metadata = getErrorCodeFromFloatValue(value);
        } else {
            metadata = null;
        }
    } else {
        // unknown metadata content
        metadata = null;
    }
    return metadata;
}

/**
 * Reads the value from the shared memory buffer based on the buffer type.
 * If the buffer type is 'singleBufferSequenceLock', it checks the sequence number to ensure data integrity.
 * @param {*} processDescription description of the shared memory buffer
 * @param {Buffer} dataBuffer complete shared memory buffer
 * @param {number} bufferStartAddress offset inside the shared memory buffer
 * @param {*} valueDescription description of the process value
 * @returns {*} the extracted process value
    */
async function readValueBasedOnBufferType(processDescription, dataBuffer, bufferStartAddress, valueDescription) {
    // the 'singleBufferSequenceLock' buffer has a sequence numer at the beginning
    // this sequence number increases with each write to the buffer
    // if this sequence number changes during read of the data, the data is invalid and should be read again
    if (getBufferType(processDescription) === 'singleBufferSequenceLock') {
        let value;
        for (let i = 0; i < 10; i++) {
            const sequenceNumberBefore = getSequenceNumber(processDescription, dataBuffer);
            value = getProcessValue(valueDescription, dataBuffer, bufferStartAddress);
            const sequenceNumberAfter = getSequenceNumber(processDescription, dataBuffer);

            // if the sequence number has not changed, the data is valid
            if (sequenceNumberBefore === sequenceNumberAfter) {
                return value;
            }
            // data has changed - sleep for 10 ms and try again
            console.log(`readValue() sequence number has changed ${sequenceNumberBefore} vs. ${sequenceNumberAfter}, retrying...`);
            await new Promise(resolve => setTimeout(resolve, 10));
        }

        // if the sequence number has changed 10 times in a row, give it up - return the last value
        return value;
    }

    const value = getProcessValue(valueDescription, dataBuffer, bufferStartAddress);
    return value;
}

/**
 * reads the sequence number from the shared memory buffer if the buffer type is 'singleBufferSequenceLock'. if not, it returns 0.
 * @param {*} processDescription description of the shared memory buffer
 * @param {Buffer} buf complete shared memory buffer
 * @returns
 */
function getSequenceNumber(processDescription, buf) {
    // only for singleBufferSequenceLock
    if (getBufferType(processDescription) === 'singleBufferSequenceLock') {
        // the sequence number is a 32-bit unsigned integer at the beginning of the buffer
        const sequenceNumber = buf.readUInt32LE(0);
        return sequenceNumber;
    }
    return 0;
}

/**
 * Extracts and returns the process value from the shared memory buffer based on the provided value description.
 *
 * @param {Object} valueDescription - The description of the process value including its type and offset in shared memory.
 * @param {Buffer} buf - The shared memory buffer containing process data.
 * @param {number} bufferStartAddress - The offset inside the shared memory buffer.
 * @returns {*} - The extracted process value.
 * @throws {Error} - Throws an error if the value type is unknown or unsupported.
 */
function getProcessValue(valueDescription, buf, bufferStartAddress) {
    // the offset for the value within the shared memory buffer.
    const offsetOfValue = valueDescription.offsetSharedMemory;

    if (bufferStartAddress + offsetOfValue >= buf.length) {
        throw new Error(`Offset ${bufferStartAddress + offsetOfValue} for value is out of range for buffer of size ${buf.length}`);
    }

    // Define a map of value types to corresponding extraction functions.
    const valueMap = new Map([
        ['Char', () => { return buf.readInt8(bufferStartAddress + offsetOfValue); }],
        ['UnsignedChar', () => { return buf.readUInt8(bufferStartAddress + offsetOfValue); }],
        ['ShortInteger', () => { return buf.readInt16LE(bufferStartAddress + offsetOfValue); }],
        ['UnsignedShortInteger', () => { return buf.readUInt16LE(bufferStartAddress + offsetOfValue); }],
        ['Integer', () => { return buf.readInt32LE(bufferStartAddress + offsetOfValue); }],
        ['UnsignedInteger', () => { return buf.readUInt32LE(bufferStartAddress + offsetOfValue); }],
        ['LongLong', () => { return buf.readBigInt64LE(bufferStartAddress + offsetOfValue); }],
        ['UnsignedLongLong', () => { return buf.readBigUInt64LE(bufferStartAddress + offsetOfValue); }],
        ['Double', () => { return buf.readDoubleLE(bufferStartAddress + offsetOfValue); }],
        ['Float', () => { return buf.readFloatLE(bufferStartAddress + offsetOfValue); }],
        ['Boolean', () => { return valueDescription.sizeValue === 1 ? buf.readUInt8(bufferStartAddress + offsetOfValue) !== 0 : buf.readUInt32LE(bufferStartAddress + offsetOfValue) !== 0; }],
        ['Bit', () => { return (buf.readUInt8(bufferStartAddress + offsetOfValue) & valueDescription.bitMask) !== 0; }],
        ['String', () => { return buf.slice(bufferStartAddress + offsetOfValue, bufferStartAddress + offsetOfValue + valueDescription.sizeValue).toString(); }],
        ['Selection', () => { return buf.slice(bufferStartAddress + offsetOfValue, bufferStartAddress + offsetOfValue + valueDescription.sizeValue).toString(); }],
        ['Selector', () => { return buf.slice(bufferStartAddress + offsetOfValue, bufferStartAddress + offsetOfValue + valueDescription.sizeValue).toString(); }]
    ]);
    // Check if the value type is known; if not, throw an error.
    if (!valueMap.has(valueDescription.type)) {
        throw new Error(`Unknown value type: ${valueDescription.type}`);
    }
    // Execute the corresponding extraction function and return the result.
    return valueMap.get(valueDescription.type)();
}

/**
 * Retrieves the human-readable error text based on the provided error code.
 *
 * @param {number | null} metadata - The error code obtained from process metadata.
 * @returns {string} - The corresponding human-readable error text.
 */
function getErrorText(metadata) {
    // Define a map of error codes to their respective human-readable error texts.
    const errorMap = new Map([
        [null, ''],
        [0, 'valid'],
        [1, 'underrange'],
        [2, 'overrange'],
        [3, 'noValidInputValue'],
        [4, 'divisionByZero'],
        [5, 'incorrectMathematicValue'],
        [6, 'invalidTemperature'],
        [7, 'sensorShortCircuit'],
        [8, 'sensorBreakage'],
        [9, 'timeout']
    ]);
    // Retrieve and return the error text corresponding to the provided error code.
    return errorMap.get(metadata) || '';
}

/**
 * Converts a float value into its binary representation and maps it to the corresponding error code.
 *
 * @param {number} value - The float value from which to extract the error code.
 * @returns {number} - The error code mapped to the provided float value.
 */
function getErrorCodeFromFloatValue(value) {
    // Converting a float into a JavaScript number lacks precision.
    // To compare the float value with the error code, it needs to be converted back into its binary float representation.
    function floatToBuffer(value) {
        const fVal = new Float32Array(1);
        fVal[0] = value;
        return Buffer.from(fVal.buffer);
    }

    // Define a map of binary float representations to their respective error codes.
    const errorMap = new Map([
        [floatToBuffer(1e37), 1],
        [floatToBuffer(2e37), 2],
        [floatToBuffer(3e37), 3],
        [floatToBuffer(4e37), 4],
        [floatToBuffer(5e37), 5],
        [floatToBuffer(6e37), 6],
        [floatToBuffer(7e37), 7],
        [floatToBuffer(8e37), 8],
        [floatToBuffer(9e37), 9]
    ]);

    // Convert the provided float value to its binary representation.
    const valueBuffer = floatToBuffer(value);

    // Iterate through the error map to find a match and return the corresponding error code.
    for (const [key, value] of errorMap.entries()) {
        if (0 == Buffer.compare(key, valueBuffer)) {
            return value;
        }
    }
    // Return 0 if no matching error code is found.
    return 0;
}

/**
 * Retrieves the error code from a double value, ensuring it falls within the valid range [0, 9].
 *
 * @param {number} value - The double value from which to extract the error code.
 * @returns {number} - The error code, or 0 if the error code is out of range or undefined.
 */
function getErrorCodeFromDoubleValue(value) {
    // Retrieve the error code from the double value.
    const errorCode = getErrorCodeFromDouble(value);

    // test if errorCode is a number between 0 and 9 (implicit conversion from string to number)
    if (errorCode >= 0 && errorCode <= 9) {
        return Number(errorCode);
    } else {
        // 'NaN' or unknown errorCode; return 0 in such cases.
        return 0;
    }
}

/**
 * Extracts the error code from the mantissa of a double value, if applicable.
 *
 * @param {number} doubleValue - The double value from which to extract the error code.
 * @returns {string} - The error code as a hexadecimal string, 'NaN' if the value is NaN, or '0' if no error code is present.
 */
function getErrorCodeFromDouble(doubleValue) {
    // Allocate a buffer of 8 bytes to store the double value.
    const buffer = Buffer.alloc(8);

    // Write the double value to the buffer in little-endian format.
    buffer.writeDoubleLE(doubleValue, 0);

    // Create a view to interpret the buffer as a BigInt.
    const uint64View = new BigUint64Array(buffer.buffer);

    // Get the 64-bit unsigned integer representation of the double value.
    const uint64Value = uint64View[0];

    // Extract exponent and mantissa bits from the 64-bit unsigned integer representation.
    const exponent = (uint64Value >> 52n) & 0x7ffn;
    const mantissa = uint64Value & 0xfffffffffffffn;

    // Check if the exponent bits are all 1s (indicating a NaN).
    if (exponent === 0x7ffn) {
        // If the mantissa is non-zero, it contains the error code as a hexadecimal string.
        if (mantissa !== 0n) {
            // If the mantissa is non-zero, the mantissa contains the error code as string
            return mantissa.toString(16);
        } else {
            // If the mantissa is zero, the value is NaN.
            return 'NaN';
        }
    } else {
        // No error code present.
        return '0';
    }
}
