import { attachToSharedMemory, getBufferType, getCurrentBufferStartAddress } from './bufferHandler.js';
import { getNestedProcessValueDescription, getObjectFromUrl } from './processValueUrl.js';
import { getProcessDataDescriptionBySelector } from './providerHandler.js';

/**
 * Writes values for the specified selectors using the writeValue function.
 *
 * @param {Array<Object>|Object} input - An array or a single object containing selector and value information.
 * @returns {Promise<Array<Object>|Object>} - A promise that resolves with an array or a single object indicating the write status.
 * @throws {Error} - Throws an error if there is an issue during the write operation.
 *
 * @description
 * This asynchronous function writes values for the specified selectors using the writeValue function. It accepts either
 * an array or a single object as input. The function iterates through the input, writing values for each selector, and
 * collects the write status. If any issues occur during the write operation, an error is thrown with a descriptive message.
 *
 * @example
 * // Example usage with an array of objects:
 * const writeInput = [
 *     { selector: 'selector1', value: 'value1' },
 *     { selector: 'selector2', value: 'value2' },
 *     // ...additional items
 * ];
 * try {
 *     const writeResults = await write(writeInput);
 *     // Process the array of write results...
 * } catch (error) {
 *     // Handle the error...
 * }
 *
 * // Example usage with a single object:
 * const singleWriteInput = { selector: 'selector3', value: 'value3' };
 * try {
 *     const writeResult = await write(singleWriteInput);
 *     // Process the single write result...
 * } catch (error) {
 *     // Handle the error...
 * }
 */
export async function write(input) {
    // wrap a single object in an array to work with the same code underneath
    if (!Array.isArray(input)) {
        input = [input];
    }

    const results = [];
    // Iterate through each item in the input and perform the write operation.
    for (const item of input) {
        try {
            await writeValue(item.selector, item.value);
            results.push({
                done: true,
            });
        } catch (e) {
            return Promise.reject(new Error(`Can't write ${JSON.stringify(item)}: ${e}`));
        }
    }

    // Return a single object if the input was a single object.
    if (results.length === 1) {
        return Promise.resolve(results[0]);
    }
    return Promise.resolve(results);
}

function validateInput(selector, value) {
    if (typeof selector !== 'string') {
        throw new Error('selector is not a string');
    }
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
        throw new Error('value is not a string, number or boolean');
    }
}

function checkReadOnly(valueDescription) {
    if (valueDescription.readOnly) {
        throw new Error('Not allowed to write read-only process values');
    }
}

function checkIfBufferIsWriteable(processDescription) {
    if (getBufferType(processDescription) === 'doubleBuffer') {
        throw new Error('Value is inside a doubleBuffer which is not allowed to write');
    }
    if (getBufferType(processDescription) === 'singleBufferSequenceLock') {
        // @todo: check if this is correct
        throw new Error('Value is inside a singleBufferSequenceLock which is *perhaps* not allowed to write');
    }
}

async function writeValue(selector, value) {
    validateInput(selector, value);

    // get process description via dbus
    const processDescription = await getProcessDataDescriptionBySelector(selector);
    const selectorDescription = getObjectFromUrl(selector);
    const valueDescription = getNestedProcessValueDescription(processDescription, selectorDescription.parameterUrl);

    // check if writing is possible
    checkReadOnly(valueDescription);
    checkInputValueType(value, valueDescription);
    checkIfBufferIsWriteable(processDescription);

    // attach to shared memory and read the content
    const memory = attachToSharedMemory(processDescription);
    const dataBuffer = memory.buffer;

    // write the value based on type and description
    const bufferStartAddress = getCurrentBufferStartAddress(processDescription, dataBuffer);
    // @todo: handle write of different buffer types if not blocked by checkIfBufferIsWriteable()
    writeProcessValue(valueDescription, value, memory, bufferStartAddress);

    // write error code 0 after successfull writing
    const errorCode = 0;
    writeErrorCodeToMetaData(valueDescription, memory, errorCode);
}

function writeErrorCodeToMetaData(valueDescription, memory, errorCode) {
    const offsetMetadata = valueDescription.offsetSharedMemory + valueDescription.relativeOffsetMetadata;
    const sizeMetadata = valueDescription.sizeMetadata;

    // Only 4-byte metadata is supported.
    if (sizeMetadata === 4) {
        // Allocate a buffer for the metadata and write the error code.
        const metadataValue = Buffer.alloc(4);
        metadataValue.writeInt32LE(errorCode);
        memory.write(metadataValue, offsetMetadata, sizeMetadata);
    }
}

/**
 * Writes the specified value to the shared memory based on the given value description.
 *
 * @param {Object} valueDescription - The description of the process value.
 * @param {string|number|boolean} value - The value to be written to the process value.
 * @param {Buffer} memory - The shared memory buffer.
 * @param {number} bufferStartAddress - The starting address within the shared memory buffer.
 * @returns {void}
 *
 * @description
 * This function writes the specified value to the shared memory based on the provided value description. It supports
 * various data types, including integers, floating-point numbers, boolean, and bit values. The function utilizes a
 * type map to determine the size and appropriate write function for each data type, and then performs the actual
 * writing to the shared memory buffer. If the value type is not recognized or handled, an error is thrown. The
 * function is typically called after validating input parameters and before updating metadata.
 *
 * @example
 * // Example usage:
 * const valueDescription = { type: 'Integer', offsetSharedMemory: 0, sizeValue: 4 };
 * const memory = // ... obtain shared memory buffer
 * const bufferStartAddress = 0;
 * const value = 42;
 * writeProcessValue(valueDescription, value, memory, bufferStartAddress);
 */
function writeProcessValue(valueDescription, value, memory, bufferStartAddress) {
    const offsetOfValue = valueDescription.offsetSharedMemory;

    if (bufferStartAddress + offsetOfValue >= memory.length) {
        throw new Error(`Offset ${bufferStartAddress + offsetOfValue} for value is out of range for buffer of size ${memory.length}`);
    }

    // Type map to determine size and write function for each data type.
    const typeMap = {
        'Char': { size: 1, writeFn: 'writeInt8' },
        'UnsignedChar': { size: 1, writeFn: 'writeUInt8' },
        'ShortInteger': { size: 2, writeFn: 'writeInt16LE' },
        'UnsignedShortInteger': { size: 2, writeFn: 'writeUInt16LE' },
        'Integer': { size: 4, writeFn: 'writeInt32LE' },
        'UnsignedInteger': { size: 4, writeFn: 'writeUInt32LE' },
        'LongLong': { size: 8, writeFn: 'writeBigInt64LE' },
        'UnsignedLongLong': { size: 8, writeFn: 'writeUBigInt64LE' },
        'Double': { size: 8, writeFn: 'writeDoubleLE' },
        'Float': { size: 4, writeFn: 'writeFloatLE' },
        'Boolean': { size: valueDescription.sizeValue, writeFn: valueDescription.sizeValue === 1 ? 'writeUInt8' : 'writeUInt32LE' },
        'Bit': { size: 1, writeFn: 'writeByte' },
        'String': { size: null, writeFn: null },
        'Selection': { size: null, writeFn: null },
        'Selector': { size: null, writeFn: null }
    };

    const typeInfo = typeMap[valueDescription.type];
    if (typeInfo) {
        if (typeInfo.size) {
            if (typeInfo.writeFn === 'writeByte') {
                //console.log(`WriteByte() ${value} startAddress: ${bufferStartAddress}, offset: ${offsetOfValue}, bitMask: ${valueDescription.bitMask}`);
                // special handling for Bit
                memory.writeByte(valueDescription.bitMask, value, bufferStartAddress + offsetOfValue);
            } else {
                // Allocate a buffer for the value and write it to the shared memory.
                const buffer = Buffer.alloc(typeInfo.size);
                buffer[typeInfo.writeFn](value);
                //console.log(`Writing ${value} startAddress: ${bufferStartAddress}, offset ${offsetOfValue} with size ${typeInfo.size}`);
                memory.write(buffer, bufferStartAddress + offsetOfValue, typeInfo.size);
            }
        } else {
            throw new Error(`Unhandled value type: ${valueDescription.type}`);
        }
    } else {
        throw new Error(`Unknown value type: ${valueDescription.type}`);
    }
}

/**
 * Checks whether the provided value is of the expected type based on the given value description.
 *
 * @param {string|number|boolean} value - The value to be checked.
 * @param {Object} valueDescription - The description of the process value.
 * @throws {Error} If the value does not match the expected type.
 *
 * @description
 * This function validates whether the provided value corresponds to the expected type specified in the process
 * value description. It categorizes the expected types into string types, boolean types, and numeric types,
 * checking the input value against the allowed types for the given process value. If the value does not match the
 * expected type, an error is thrown with a descriptive message indicating the mismatch. This function is typically
 * called before writing a process value to ensure data integrity.
 *
 * @example
 * // Example usage:
 * const value = 42;
 * const valueDescription = { type: 'Integer' };
 * checkInputValueType(value, valueDescription);
 */
function checkInputValueType(value, valueDescription) {
    const stringtypes = ['String', 'Selection', 'Selector'];
    const booltypes = ['Boolean', 'Bit'];
    const numbertypes = ['Char', 'UnsignedChar', 'ShortInteger', 'UnsignedShortInteger', 'Integer', 'UnsignedInteger', 'LongLong', 'UnsignedLongLong', 'Double', 'Float'];

    if (typeof value === 'string') {
        if (!stringtypes.includes(valueDescription.type)) {
            throw new Error(`writing process value: invalid type of process value for this selector. Value should be ${valueDescription.type}, not a string.`);
        }
    }
    if (typeof value === 'boolean') {
        if (!booltypes.includes(valueDescription.type)) {
            throw new Error(`writing process value: invalid type of process value for this selector. Value should be ${valueDescription.type}, not a boolean.`);
        }
    }
    if (typeof value === 'number') {
        if (!numbertypes.includes(valueDescription.type)) {
            throw new Error(`writing process value: invalid type of process value for this selector. Value should be ${valueDescription.type}, not a number.`);
        }
    }
}
