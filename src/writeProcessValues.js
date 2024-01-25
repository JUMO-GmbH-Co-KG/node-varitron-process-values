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
        const offset = isDoubleBuffer ? offsetManagementBuffer + activeWriteBuffer * lengthSharedMemory : 0;

        writeProcessValue(valueDescription, value, memory, offset);

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

// eslint-disable-next-line max-statements, complexity
function writeProcessValue(valueDescription, processValue, memory, offset) {
    // Momentan sind die folgenden Datentypen implementiert:
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

    if (valueDescription.type == 'ShortInteger') {
        const int16Value = Buffer.alloc(2);
        int16Value.writeInt16LE(processValue);
        memory.write(int16Value, offsetValue + offset, 2);
    }
    else if (valueDescription.type == 'UnsignedShortInteger') {
        const uint16Value = Buffer.alloc(2);
        uint16Value.writeUInt16LE(processValue);
        memory.write(uint16Value, offsetValue + offset, 2);
    }
    else if (valueDescription.type == 'Integer') {
        const int32Value = Buffer.alloc(4);
        int32Value.writeInt32LE(processValue);
        memory.write(int32Value, offsetValue + offset, 4);
    }
    else if (valueDescription.type == 'UnsignedInteger') {
        const uint32Value = Buffer.alloc(4);
        uint32Value.writeUInt32LE(processValue);
        memory.write(uint32Value, offsetValue + offset, 4);
    }
    else if (valueDescription.type == 'LongLong') {
        const long = Buffer.alloc(8);
        long.writeBigInt64LE(processValue);
        memory.write(long, offsetValue + offset, 8);
    }
    else if (valueDescription.type == 'UnsignedLongLong') {
        const ulong = Buffer.alloc(8);
        ulong.writeUBigInt64LE(processValue);
        memory.write(ulong, offsetValue + offset, 8);
    }
    else if (valueDescription.type == 'Double') {
        const double = Buffer.alloc(8);
        double.writeDoubleLE(processValue);
        memory.write(double, offsetValue + offset, 8);
    }
    else if (valueDescription.type == 'Float') {
        const float = Buffer.alloc(4);
        float.writeFloatLE(processValue);
        memory.write(float, offsetValue + offset, 4);
    }
    else if (valueDescription.type == 'Boolean') {
        if (valueDescription.sizeValue == 4) {
            const bool = Buffer.alloc(4);
            bool.writeUInt32LE(processValue);
            memory.write(bool, offsetValue + offset, 4);
        } else if (valueDescription.sizeValue == 1) {
            const bool = Buffer.alloc(1);
            bool.writeUInt8(processValue);
            memory.write(bool, offsetValue + offset, 1);
        }
    }
    else if (valueDescription.type == 'Bit') {
        memory.writeByte(valueDescription.bitMask, processValue, offsetValue + offset);
    }
    else if (valueDescription.type == 'String') {
        throw new Error('writing process values: unhandled type: String');
    }
    else if (valueDescription.type == 'Selection') {
        throw new Error('writing process values: unhandled type: Selection');
    }
    else if (valueDescription.type == 'Selector') {
        throw new Error('writing process values: unhandled type: Selector');
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
