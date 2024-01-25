import { getProcessDataDescription } from './providerHandler.js';
import { getObjectFromUrl, getNestedProcessValueDescription } from './processValueUrl.js';
import { native } from './importShm.js';

// map to store shared memory objects with the shmKey as key 
const sharedMemoryMap = new Map();

export async function write(input) {
    // wrap a single object in an array
    if (!Array.isArray(input)) {
        input = [input];
    }

    const results = [];
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

    // return a single object if input was a single object
    if (results.length === 1) {
        return Promise.resolve(results[0]);
    }
    return Promise.resolve(results);
}

// eslint-disable-next-line max-statements, complexity
async function writeValue(selector, value) {
    // validate input
    if (typeof selector !== 'string') {
        return Promise.reject(new Error('selector is not a string'));
    }
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
        return Promise.reject(new Error('value is not a string, number or boolean'));
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
    if (valueDescription.readOnly) {
        return Promise.reject(new Error('Not allowed to write read-only process values'));
    }

    //checks for correct type of input value
    checkInputValueType(value, valueDescription);

    /* ManagementBuffer structure (12 byte length)
    *  0 = activeReadBuffer
    *  4 = activeWriteBuffer
    *  8 = seqlock (flag for buffer manipulation)
    */
    const offsetManagementBuffer = 12;
    const isDoubleBuffer = processDescription.doubleBuffer;
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
            // create shared memory object in c++
            const creationType = 0; // attachToExistingLock
            memory = new native.SharedMemory(shmKey, sizeSharedMemory, isDoubleBuffer, semaphoreKey, creationType);
            sharedMemoryMap.set(shmKey, memory);
        } else {
            memory = sharedMemoryMap.get(shmKey);
        }

        const buf = memory.buffer;

        // get the active read buffer from management buffer if double buffer is used
        const activeWriteBuffer = isDoubleBuffer ? buf.readUInt32LE(4) : 0;

        // calculate general offset inside shared memory depending on buffer type
        const bufferStartAddress = isDoubleBuffer ? offsetManagementBuffer + activeWriteBuffer * lengthSharedMemory : 0;

        writeProcessValue(valueDescription, value, memory, bufferStartAddress);

        // write error code 0 after successfull writing
        const errorCode = 0;
        writeErrorCodeToMetaData(valueDescription, memory, errorCode);

        return Promise.resolve();
    } catch (e) {
        return Promise.reject(e);
    }
}

function writeErrorCodeToMetaData(valueDescription, memory, errorCode) {
    const offsetMetadata = valueDescription.offsetSharedMemory + valueDescription.relativeOffsetMetadata;
    const sizeMetadata = valueDescription.sizeMetadata;

    // only 4 byte metadata is supported
    if (sizeMetadata === 4) {
        const metadataValue = Buffer.alloc(4);
        metadataValue.writeInt32LE(errorCode);
        memory.write(metadataValue, offsetMetadata, sizeMetadata);
    }
}

function writeProcessValue(valueDescription, value, memory, bufferStartAddress) {
    const offsetValue = valueDescription.offsetSharedMemory;

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
