import { getProcessDataDescription } from './providerHandler.js';
import { getObjectFromUrl, getNestedProcessValueDescription } from './processValueUrl.js';
import { native } from './importShm.js';

// map to store shared memory objects with the shmKey as key 
const sharedMemoryMap = new Map();

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
            const result = await readFromUrl(selector);
            results.push(result);
        } catch (e) {
            return Promise.reject(new Error(`Can't read process value of ${JSON.stringify(item)}: ${e}`));
        }
    }

    // return a single object if input was a single object
    if (results.length === 1) {
        return Promise.resolve(results[0]);
    }
    return Promise.resolve(results);
}

// read function
// eslint-disable-next-line max-statements
async function readFromUrl(selector) {
    // validate input
    if (typeof selector !== 'string') {
        return Promise.reject(new Error('selector is not a string'));
    }

    // get parameters from selector
    const selectorDescription = getObjectFromUrl(selector);

    // get ProcessDataDescription from DBus
    const processDescription = await getProcessDataDescription(
        selectorDescription.moduleName,
        selectorDescription.instanceName,
        selectorDescription.objectName,
        'us_EN');

    const valueDescription = getNestedProcessValueDescription(processDescription, selectorDescription.parameterUrl);

    /* ManagementBuffer structure (12 byte length)
    *  0 = activeReadBuffer
    *  4 = activeWriteBuffer
    *  8 = seqlock (flag for buffer manipulation)
    */
    const offsetManagementBuffer = 12;
    const isDoubleBuffer = processDescription.doubleBuffer;
    const sharedMemoryKey = processDescription.key;
    const lengthSharedMemory = processDescription.sizeOfSharedMemory;

    // the size of the shared memory depends on the buffer type - double buffer needs 2x the size
    const sizeSharedMemory = isDoubleBuffer ? 2 * lengthSharedMemory + offsetManagementBuffer : lengthSharedMemory;

    // get shmKey by key from description file plus extension
    const shmKey = sharedMemoryKey + 'SharedMemory';

    // set semaphore name based on buffer type
    const semaphoreKey = `${sharedMemoryKey}Semaphore${isDoubleBuffer ? 'WriteLock' : 'BufferLock'}`;
    try {
        // if the shared memory object is not yet created, create it, else use the existing one
        let memory;
        if (!sharedMemoryMap.has(shmKey)) {
            // create shared memory object in c++
            const creationType = 0; // attachToExistingLock
            memory = new native.SharedMemory(shmKey, sizeSharedMemory, isDoubleBuffer, semaphoreKey, creationType);
            sharedMemoryMap.set(shmKey, memory);
        } else {
            memory = sharedMemoryMap.get(shmKey);
        }

        const buf = memory.buffer;

        // get the active read buffer from management buffer if double buffer is used
        const activeReadBuffer = isDoubleBuffer ? buf.readUInt32LE(0) : 0;

        // calculate general offset inside shared memory depending on buffer type
        const bufferStartAddress = isDoubleBuffer ? offsetManagementBuffer + activeReadBuffer * lengthSharedMemory : 0;

        // read value from shared memory based on type
        const value = getProcessValue(valueDescription, buf, bufferStartAddress);

        // read metadata from process value - this contains the error code
        const errorCode = getErrorCodeFromMetaData(valueDescription, buf, bufferStartAddress, value);
        const errorText = getErrorText(errorCode);

        // until now only one measurement range is supported
        const measurementRangeIndex = 0;
        const measurementRange = valueDescription.measurementRangeAttributes?.[measurementRangeIndex];

        // use POSIX language for unit because this is always available
        const unit = measurementRange?.unitText?.POSIX || '';

        const result = {
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

        return Promise.resolve(result);
    } catch (e) {
        return Promise.reject(e);
    }
}

function getErrorCodeFromMetaData(valueDescription, buf, bufferStartAddress, value) {
    const offsetMetadata = valueDescription.offsetSharedMemory + valueDescription.relativeOffsetMetadata;

    let metadata;
    if (valueDescription.sizeMetadata == 4) {
        // standard: metadata containing an 32 bit error code
        metadata = buf.readUInt32LE(offsetMetadata + bufferStartAddress);
    } else if (valueDescription.sizeMetadata == 0) {
        // metadata containing no error code
        // for legacy jumo modules extract error code from value
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

function getProcessValue(valueDescription, buf, bufferStartAddress) {
    const offsetValue = valueDescription.offsetSharedMemory;

    const valueMap = new Map([
        ['ShortInteger', () => { return buf.readInt16LE(bufferStartAddress + offsetValue); }],
        ['UnsignedShortInteger', () => { return buf.readUInt16LE(bufferStartAddress + offsetValue); }],
        ['Integer', () => { return buf.readInt32LE(bufferStartAddress + offsetValue); }],
        ['UnsignedInteger', () => { return buf.readUInt32LE(bufferStartAddress + offsetValue); }],
        ['LongLong', () => { return buf.readBigInt64LE(bufferStartAddress + offsetValue); }],
        ['UnsignedLongLong', () => { return buf.readBigUInt64LE(bufferStartAddress + offsetValue); }],
        ['Double', () => { return buf.readDoubleLE(bufferStartAddress + offsetValue); }],
        ['Float', () => { return buf.readFloatLE(bufferStartAddress + offsetValue); }],
        ['Boolean', () => { return valueDescription.sizeValue === 1 ? buf.readUInt8(bufferStartAddress + offsetValue) !== 0 : buf.readUInt32LE(bufferStartAddress + offsetValue) !== 0; }],
        ['Bit', () => { return (buf.readUInt8(bufferStartAddress + offsetValue) & valueDescription.bitMask) !== 0; }],
        ['String', () => { return buf.slice(bufferStartAddress + offsetValue, bufferStartAddress + offsetValue + valueDescription.sizeValue).toString(); }],
        ['Selection', () => { return buf.slice(bufferStartAddress + offsetValue, bufferStartAddress + offsetValue + valueDescription.sizeValue).toString(); }],
        ['Selector', () => { return buf.slice(bufferStartAddress + offsetValue, bufferStartAddress + offsetValue + valueDescription.sizeValue).toString(); }]
    ]);

    if (!valueMap.has(valueDescription.type)) {
        throw new Error(`Unknown value type: ${valueDescription.type}`);
    }
    return valueMap.get(valueDescription.type)();
}

/*
* function: getErrorText
* function to resolve a errorCode to a errorText
*/
function getErrorText(metadata) {
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

    return errorMap.get(metadata) || '';
}

/*
* function: getErrorCodeFromFloatValue
* function to resolve a errorCode from Float ProcessValue
*/
function getErrorCodeFromFloatValue(value) {
    // converting a float into a js number lacks precision
    // to compare the float value with the error code we need to convert it back into
    // its binary float representation
    function floatToBuffer(value) {
        const fVal = new Float32Array(1);
        fVal[0] = value;
        return Buffer.from(fVal.buffer);
    }

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

    const valueBuffer = floatToBuffer(value);
    for (const [key, value] of errorMap.entries()) {
        if (0 == Buffer.compare(key, valueBuffer)) {
            return value;
        }
    }
    return 0;
}

/*
* function: getErrorCodeFromDoubleValue
* function to resolve a errorCode from Double ProcessValue
*/
function getErrorCodeFromDoubleValue(value) {
    //handling of doubles
    const errorCode = getErrorCodeFromDouble(value);

    // test if errorCode is a number between 0 and 9 (implicit conversion from string to number)
    if (errorCode >= 0 && errorCode <= 9) {
        return Number(errorCode);
    } else {
        // 'NaN' or unknown errorCode
        return 0;
    }
}

// function to extract NaN Payload from double value
function getErrorCodeFromDouble(doubleValue) {
    const buffer = Buffer.alloc(8); // Allocate buffer of 8 bytes
    buffer.writeDoubleLE(doubleValue, 0); // Write the double value to the buffer

    const uint64View = new BigUint64Array(buffer.buffer); // Create a view to interpret the buffer as a BigInt
    const uint64Value = uint64View[0]; // Get the 64-bit unsigned integer representation

    const exponent = (uint64Value >> 52n) & 0x7ffn; // Extract exponent bits
    const mantissa = uint64Value & 0xfffffffffffffn; // Extract mantissa bits

    if (exponent === 0x7ffn) {
        // If the exponent bits are all 1s (indicating a NaN)
        if (mantissa !== 0n) {
            // If the mantissa is non-zero, the mantissa contains the error code as string
            return mantissa.toString(16);
        } else {
            return 'NaN';
        }
    } else {
        // No error code
        return '0';
    }
}
