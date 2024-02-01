import { getProcessDataDescription } from './providerHandler.js';
import { getObjectFromUrl, getNestedProcessValueDescription } from './processValueUrl.js';
import { native } from './importShm.js';

// map to store shared memory objects with the shmKey as key 
const sharedMemoryMap = new Map();

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

    // Initialize an array to store write results.
    const results = [];
    // Iterate through each item in the input and perform the write operation.
    for (const item of input) {
        try {
            await writeValue(item.selector, item.value);
            results.push({
                done: true,
            });
        } catch (e) {
            // Generate an error message for issues during the write operation.
            return Promise.reject(new Error(`Can't write ${JSON.stringify(item)}: ${e}`));
        }
    }

    // Return a single object if the input was a single object.
    if (results.length === 1) {
        return Promise.resolve(results[0]);
    }
    // Resolve the promise with the array of write results.
    return Promise.resolve(results);
}
/**
 * Writes the specified value to the shared memory based on the given selector.
 *
 * @param {string} selector - The selector specifying the process value to write.
 * @param {string|number|boolean} value - The value to be written to the process value.
 * @returns {Promise<void>} - A promise that resolves after the write operation is completed successfully.
 * @throws {Error} - Throws an error if there is an issue during the write operation or if validation checks fail.
 *
 * @description
 * This asynchronous function validates the input parameters, retrieves the necessary process description information
 * from DBus, and writes the specified value to the shared memory. It performs validation checks on the selector and value
 * types, ensures that the process value is not read-only, and handles double buffer restrictions. If successful, it writes
 * the value to the shared memory, updates the error code metadata, and resolves the promise. If any issues occur during
 * the process, an error is thrown with a descriptive message.
 *
 * @example
 * // Example usage:
 * const selector = 'exampleSelector';
 * const value = 42;
 * try {
 *     await writeValue(selector, value);
 *     // The write operation was successful...
 * } catch (error) {
 *     // Handle the error...
 * }
 */
// eslint-disable-next-line max-statements, complexity
async function writeValue(selector, value) {
    // Validate the input parameters.
    if (typeof selector !== 'string') {
        return Promise.reject(new Error('selector is not a string'));
    }
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
        return Promise.reject(new Error('value is not a string, number or boolean'));
    }

    // Get parameters from the selector.
    const selectorDescription = getObjectFromUrl(selector);

    // Get ProcessDataDescription from DBus.
    const processDescription = await getProcessDataDescription(
        selectorDescription.moduleName,
        selectorDescription.instanceName,
        selectorDescription.objectName,
        'us_EN');

    // Get the nested process value description based on the parameter URL.
    const valueDescription = getNestedProcessValueDescription(processDescription, selectorDescription.parameterUrl);

    // Check if the process value is read-only.
    if (valueDescription.readOnly) {
        return Promise.reject(new Error('Not allowed to write read-only process values'));
    }

    // Perform additional checks for the correct type of input value.
    checkInputValueType(value, valueDescription);

    /* ManagementBuffer structure (12 byte length)
    *  0 = activeReadBuffer
    *  4 = activeWriteBuffer
    *  8 = seqlock (flag for buffer manipulation)
    */
    const offsetManagementBuffer = 12;
    const isDoubleBuffer = processDescription.doubleBuffer;

    // Check for double buffer and restrict writing if present.
    if (isDoubleBuffer) {
        return Promise.reject(new Error('Value is inside a double buffer. It is not allowed to write to double buffer'));
    }
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
            // Create shared memory object in C++.
            const creationType = 0; // attachToExistingLock
            memory = new native.SharedMemory(shmKey, sizeSharedMemory, isDoubleBuffer, semaphoreKey, creationType);
            sharedMemoryMap.set(shmKey, memory);
        } else {
            memory = sharedMemoryMap.get(shmKey);
        }

        const buf = memory.buffer;

        // Get the active write buffer from the management buffer if double buffer is used.
        const activeWriteBuffer = isDoubleBuffer ? buf.readUInt32LE(4) : 0;

        // Calculate the general offset inside shared memory depending on the buffer type.
        const bufferStartAddress = isDoubleBuffer ? offsetManagementBuffer + activeWriteBuffer * lengthSharedMemory : 0;

        // Write the process value to the shared memory.
        writeProcessValue(valueDescription, value, memory, bufferStartAddress);

        // Write error code 0 after successful writing.
        const errorCode = 0;
        writeErrorCodeToMetaData(valueDescription, memory, errorCode);

        return Promise.resolve();
    } catch (e) {
        return Promise.reject(e);
    }
}
/**
 * Writes the error code to the metadata section of the shared memory based on the given value description.
 *
 * @param {Object} valueDescription - The description of the process value.
 * @param {Buffer} memory - The shared memory buffer.
 * @param {number} errorCode - The error code to be written to the metadata.
 * @returns {void}
 *
 * @description
 * This function writes the specified error code to the metadata section of the shared memory. It takes the value
 * description, shared memory buffer, and error code as parameters, calculates the offset within the metadata section,
 * and writes the error code to the buffer. Currently, only 4-byte metadata is supported. The function is designed to be
 * called after a successful write operation to update the metadata with the corresponding error code.
 *
 * @example
 * // Example usage:
 * const valueDescription = { offsetSharedMemory: 0, relativeOffsetMetadata: 4, sizeMetadata: 4 };
 * const memory = // ... obtain shared memory buffer
 * const errorCode = 0;
 * writeErrorCodeToMetaData(valueDescription, memory, errorCode);
 */
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
    const offsetValue = valueDescription.offsetSharedMemory;

    // Type map to determine size and write function for each data type.
    const typeMap = {
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
                // special handling for Bit
                memory.writeByte(valueDescription.bitMask, value, bufferStartAddress + offsetValue);
            } else {
                // Allocate a buffer for the value and write it to the shared memory.
                const buffer = Buffer.alloc(typeInfo.size);
                buffer[typeInfo.writeFn](value);
                memory.write(buffer, bufferStartAddress + offsetValue, typeInfo.size);
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
    const numbertypes = ['ShortInteger', 'UnsignedShortInteger', 'Integer', 'UnsignedInteger', 'LongLong', 'UnsignedLongLong', 'Double', 'Float'];

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
