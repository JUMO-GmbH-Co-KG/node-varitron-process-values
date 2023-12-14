import { getProcessDataDescription } from './providerHandler.js';
import { getObjectFromUrl, byString as getNestedProcessValueDescription } from './processValueUrl.js';
import { native } from './importShm.js';

export async function write(object) {
    if (typeof object === 'object') {
        if (Array.isArray(object)) {
            // It's an array of objects
            object.forEach(async function (item) {
                // Process each object in the array
                // item is a single object
                try {
                    await writeValue(item.processValueUrl, item.processValue);
                } catch (e) {
                    console.error('cant write value: ' + item.processValueUrl + '. ' + e);
                }
                return Promise.resolve();
            });
        } else {
            // It's a single object
            // You can process it here
            try {
                await writeValue(object.processValueUrl, object.processValue);
                return Promise.resolve();
            } catch (e) {
                return Promise.reject('cant write value: ' + e);
            }
        }
    } else {
        // It's not an object
        return Promise.reject('Input is not an object or an array of objects.');
    }
}

// eslint-disable-next-line max-statements, complexity
async function writeValue(processValueUrl, processValue) {
    const urlObject = getObjectFromUrl(processValueUrl);

    // get ProcessDataDescription from DBus
    const processDescription = await getProcessDataDescription(
        urlObject.moduleName,
        urlObject.instanceName,
        urlObject.objectName,
        'us_EN');

    const valueDescription = getNestedProcessValueDescription(processDescription, urlObject.parameterUrl);
    if (valueDescription.readOnly) {
        return Promise.reject('Not allowed to write read Only process values');
    }
    const offsetValue = valueDescription.offsetSharedMemory;
    //get offset from Metadata of the object in shared memory
    const offsetMetadata = valueDescription.offsetSharedMemory + valueDescription.relativeOffsetMetadata;
    //get size of Metdadata of the object in shared memory
    const sizeMetadata = valueDescription.sizeMetadata;
    const OffsetManagementBuffer = 12;
    // double buffered shared memory
    //const size = 2 * LengthSharedMemory + OffsetManagementBuffer; //748
    const doubleBuffer = processDescription.doubleBuffer;
    if (doubleBuffer) {
        return Promise.reject('Not allowed to write to doublebuffer');
    }
    const keyFromDescription = processDescription.key;
    const LengthSharedMemory = processDescription.sizeOfSharedMemory;
    const size = doubleBuffer ? 2 * LengthSharedMemory + OffsetManagementBuffer : LengthSharedMemory;
    console.log(doubleBuffer, keyFromDescription, LengthSharedMemory, size);

    // get shmKey by key from description file
    const shmKey = keyFromDescription + 'SharedMemory';
    console.log('byDescKey: ' + shmKey);

    console.log('attaching to shm...');
    const keyForBufferLocking = doubleBuffer ? 'WriteLock' : 'BufferLock';
    const readSemaphore = processDescription.key + 'Semaphore' + keyForBufferLocking;
    try {
        const memory = new native.shared_memory(shmKey, size, doubleBuffer, readSemaphore, 0);

        // Read the data into a buffer
        const buf = memory.buffer;


        //const activeReadBuffer = buf.readUInt32LE(0);
        const activeWriteBuffer = doubleBuffer ? buf.readUInt32LE(4) : 0;
        const offset = doubleBuffer ? OffsetManagementBuffer + activeWriteBuffer * LengthSharedMemory : 0;

        // *          Momentan sind die folgenden Datentypen implementiert:
        // *
        // *          ShortInteger - signed short 16bit
        // *          UnsignedShortInteger - unsigned short 16bit
        // *          Integer - int 32bit
        // *          UnsignedInteger - unsigned int 32 bit
        // *          LongLong - signed long long 64bit
        // *          UnsignedLongLong - unsigned long long 64bit
        // *          Double - Gleitkommazahl mit doppelter Genauigkeit
        // *          Float - Gleitkommazahl mit einfacher Genauigkeit
        // *          Boolean - C++11 Typ bool
        // *          Bit - ein Bit in einem Byte
        // *          String - QString
        // *          Selection - QString
        // *          Selector - QString

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
            // let byte = buf.readUInt8(offsetObject + offset);
            // if (processValue) {
            //     // Set the bit (1) in the byte at the specified position
            //     byte |= object.bitMask;
            // } else {
            //     // Clear the bit (0) in the byte at the specified position
            //     byte &= ~object.bitMask;
            // }
            // const bytebuffer = Buffer.alloc(1);
            // bytebuffer.writeUInt8(byte);
            // memory.write(bytebuffer, offsetObject + offset, 1);
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

        //write errorcode 0 after writing
        if (sizeMetadata == 4) {
            const metadataValue = Buffer.alloc(4);
            metadataValue.writeInt32LE(0);
            memory.write(metadataValue, offsetMetadata, 4);
        }

        return Promise.resolve();
    } catch (e) {
        return Promise.reject(e);
    }
}

