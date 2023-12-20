import { getProcessDataDescription } from './providerHandler.js';
import { getObjectFromUrl, getNestedProcessValueDescription } from './processValueUrl.js';
import { native } from './importShm.js';

export async function read(input) {
    // wrap a single object in an array
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
        // create shared memory object in c++
        const creationType = 0; // attachToExistingLock
        const memory = new native.SharedMemory(shmKey, sizeSharedMemory, isDoubleBuffer, semaphoreKey, creationType);

        const buf = memory.buffer;

        // get the active read buffer from management buffer if double buffer is used
        const activeReadBuffer = isDoubleBuffer ? buf.readUInt32LE(0) : 0;

        // calculate general offset inside shared memory depending on buffer type
        const offset = isDoubleBuffer ? offsetManagementBuffer + activeReadBuffer * lengthSharedMemory : 0;

        // read out value from shared memory based on type
        const value = getProcessValue(valueDescription, buf, offset);

        // read out metadata from process value - this contains the error code
        const errorCode = getErrorCodeFromMetaData(valueDescription, buf, offset, value);
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

function getErrorCodeFromMetaData(valueDescription, buf, offset, value) {
    const offsetMetadata = valueDescription.offsetSharedMemory + valueDescription.relativeOffsetMetadata;

    let metadata;
    if (valueDescription.sizeMetadata == 4) {
        // standard: metadata containing an 32 bit error code
        metadata = buf.readUInt32LE(offsetMetadata + offset);
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

// eslint-disable-next-line complexity, max-statements
function getProcessValue(valueDescription, buf, offset) {
    // Momentan sind die folgenden Datentypen implementiert
    // * ShortInteger - signed short 16bit
    // * UnsignedShortInteger - unsigned short 16bit
    // * Integer - int 32bit
    // * UnsignedInteger - unsigned int 32 bit
    // * LongLong - signed long long 64bit
    // * UnsignedLongLong - unsigned long long 64bit
    // * Double - Gleitkommazahl mit doppelter Genauigkeit
    // * Float - Gleitkommazahl mit einfacher Genauigkeit
    // * Boolean - C++11 Typ bool
    // * Bit - ein Bit in einem Byte
    // * String - QString
    // * Selection - QString
    // * Selector - QString      
    const offsetValue = valueDescription.offsetSharedMemory;

    let value;
    if (valueDescription.type == 'ShortInteger') {
        value = buf.readInt16LE(offsetValue + offset);
    }
    else if (valueDescription.type == 'UnsignedShortInteger') {
        value = buf.readUInt16LE(offsetValue + offset);
    }
    else if (valueDescription.type == 'Integer') {
        value = buf.readInt32LE(offsetValue + offset);
    }
    else if (valueDescription.type == 'UnsignedInteger') {
        value = buf.readUInt32LE(offsetValue + offset);
    }
    else if (valueDescription.type == 'LongLong') {
        value = buf.readBigInt64LE(offsetValue + offset);
    }
    else if (valueDescription.type == 'UnsignedLongLong') {
        value = buf.readBigUInt64LE(offsetValue + offset);
    }
    else if (valueDescription.type == 'Double') {
        value = buf.readDoubleLE(offsetValue + offset);
    }
    else if (valueDescription.type == 'Float') {
        value = buf.readFloatLE(offsetValue + offset);
    }
    else if (valueDescription.type == 'Boolean') {
        if (valueDescription.sizeValue == 1) {
            const tmpvalue = buf.readUInt8(offsetValue + offset);
            value = tmpvalue != 0;
        } else if (valueDescription.sizeValue == 4) {
            const tmpvalue = buf.readUInt32LE(offsetValue + offset);
            value = tmpvalue != 0;
        }
    }
    else if (valueDescription.type == 'Bit') {
        const tmpvalue = buf.readUInt8(offsetValue + offset);
        if (tmpvalue & valueDescription.bitMask == 0) {
            value = false;
        } else {
            value = true;
        }
    }
    else if (valueDescription.type == 'String') {
        const tmpbuffer = buf.slice(offsetValue + offset, offsetValue + offset + valueDescription.sizeValue);
        value = tmpbuffer.toString();
    }
    else if (valueDescription.type == 'Selection') {
        const tmpbuffer = buf.slice(offsetValue + offset, offsetValue + offset + valueDescription.sizeValue);
        value = tmpbuffer.toString();
    }
    else if (valueDescription.type == 'Selector') {
        const tmpbuffer = buf.slice(offsetValue + offset, offsetValue + offset + valueDescription.sizeValue);
        value = tmpbuffer.toString();
    }
    return value;
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
    const errorMap = new Map([
        [1e37, 1],
        [2e37, 2],
        [3e37, 3],
        [4e37, 4],
        [5e37, 5],
        [6e37, 6],
        [7e37, 7],
        [8e37, 8],
        [9e37, 9]
    ]);

    return errorMap.get(value) || 0;
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
