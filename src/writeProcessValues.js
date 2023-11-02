import { getProcessDataDescription } from './systemInformationManager.js';
import { getModuleName, getInstanceName, getObjectName, getObjectFromUrl, byString } from "./processValueUrl.js";
import { createHash } from 'crypto';
import { statSync } from 'fs';

import { native } from './importShm.js';
import { isUtf8 } from 'buffer';


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
        return Promise.reject("Input is not an object or an array of objects.");
    }

}

async function writeValue(processValueUrl, processValue) {

    // Parameter is a value
    const moduleName = getModuleName(processValueUrl);
    const instanceName = getInstanceName(processValueUrl);
    const objectName = getObjectName(processValueUrl);

    const parameter = getObjectFromUrl(processValueUrl);
    const processDescription = await getProcessDataDescription(moduleName, instanceName, objectName, 'us_EN');

    const object = byString(processDescription, parameter.parameterUrl);
    if (object.readOnly) {
        return Promise.reject('Not allowed to write read Only process values');
    }
    var offsetObject = object.offsetSharedMemory;
    var offsetMetadata = object.offsetSharedMemory + object.relativeOffsetMetadata;

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
    const shmKeyNumber = getShmKeyByDescriptionKey(keyFromDescription);
    const shmKeyFixed = shmKeyNumber == -1 ? 0x5118001d : shmKeyNumber;
    const shmKey = '0x' + shmKeyFixed.toString(16);
    console.log('byDescKey: ' + shmKey + (shmKeyNumber == -1 ? ' (fixed)' : ''));

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

        if (object.type == 'ShortInteger') {
            const int16Value = Buffer.alloc(2);
            int16Value.writeInt16LE(processValue);
            try {
                memory.write(int16Value, offsetObject + offset, 2);
            } catch (e) {
                return Promise.reject('Unable to write shared memory.' + e)
            }

        }
        else if (object.type == 'UnsignedShortInteger') {
            const uint16Value = Buffer.alloc(2);
            uint16Value.writeUInt16LE(processValue);
            memory.write(uint16Value, offsetObject + offset, 2);
        }
        else if (object.type == 'Integer') {
            const int32Value = Buffer.alloc(4);
            int32Value.writeInt32LE(processValue);
            memory.write(int32Value, offsetObject + offset, 4);
        }
        else if (object.type == 'UnsignedInteger') {
            const uint32Value = Buffer.alloc(4);
            uint32Value.writeUInt32LE(processValue);
            memory.write(uint32Value, offsetObject + offset, 4);
        }
        else if (object.type == 'LongLong') {
            const long = Buffer.alloc(8);
            long.writeBigInt64LE(processValue);
            memory.write(long, offsetObject + offset, 8);
        }
        else if (object.type == 'UnsignedLongLong') {
            const ulong = Buffer.alloc(8);
            ulong.writeUBigInt64LE(processValue);
            memory.write(ulong, offsetObject + offset, 8);
        }
        else if (object.type == 'Double') {
            const double = Buffer.alloc(8);
            double.writeDoubleLE(processValue);
            memory.write(double, offsetObject + offset, 8);
        }
        else if (object.type == 'Float') {
            const float = Buffer.alloc(4);
            float.writeFloatLE(processValue);
            memory.write(float, offsetObject + offset, 4);
        }
        else if (object.type == 'Boolean') {
            if (object.sizeValue == 4) {
                const bool = Buffer.alloc(4);
                bool.writeUInt32LE(processValue);
                memory.write(bool, offsetObject + offset, 4);
            } else if (object.sizeValue == 1) {
                const bool = Buffer.alloc(1);
                bool.writeUInt8(processValue);
                memory.write(bool, offsetObject + offset, 1);
            }
        }
        else if (object.type == 'Bit') {
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
            memory.writeByte(object.bitMask, processValue, offsetObject + offset);
        }
        else if (object.type == 'String') {
            throw new Error('writing process values: unhandled type: String');
        }
        else if (object.type == 'Selection') {
            throw new Error('writing process values: unhandled type: Selection');
        }
        else if (object.type == 'Selector') {
            throw new Error('writing process values: unhandled type: Selector');
        }
        return Promise.resolve();

    } catch (e) {
        console.error(e);
        return Promise.reject(e);

    }
}

// reimplement the jupiter-qt way from a key of a description file to the unix shmKey
const getShmKeyByDescriptionKey = (descKey) => {
    const keyPrependixFromJupiterApplication = 'SharedMemory'; // this is useless - qt also prepends a string with sharedmemory
    const pathForQtSharedMemory = '/tmp'; // this might not be the correct path for the device
    const qtFilePrefix = 'qipc_sharedmemory_';

    const descKeyLettersOnly = descKey.replace(/[^a-zA-Z]+/g, ''); // qt removes all but letters to be 'PlatformSafe'

    const shasum = createHash('sha1');
    shasum.update(descKey + keyPrependixFromJupiterApplication);
    const shaOfKey = shasum.digest('hex');

    // '/tmp/qipc_sharedmemory_SystemObserverSystemObserverdSharedMemorya513c557e8801418aebfbb0791721a60a59ea14b';
    const path = `${pathForQtSharedMemory}/${qtFilePrefix}${descKeyLettersOnly}${keyPrependixFromJupiterApplication}${shaOfKey}`;
    console.log('path: ' + path);

    const pId = 81; // 'Q' <- Qt uses this
    return ftok(path, pId);
};

// https://man7.org/linux/man-pages/man3/ftok.3.html
// https://www.npmjs.com/package/ftok?activeTab=code
function ftok(path, proj_id) {
    try {
        var stats = statSync(path);

        return (stats.ino & 0xffff) | ((stats.dev & 0xff) << 16) | ((proj_id & 0xff) << 24);
    } catch (error) {
        return -1;
    }
};