import { getModuleName, getInstanceName, getObjectName, getObjectFromUrl, byString } from "./processValueUrl.js";
import { getProcessDataDescription } from './systemInformationManager.js';


export async function write(processValueUrl, processValue) {

    const moduleName = getModuleName(processValueUrl);
    const instanceName = getInstanceName(processValueUrl);
    const objectName = getObjectName(processValueUrl);

    const parameter = getObjectFromUrl(processValueUrl);
    const processDescription = await getProcessDataDescription(moduleName, instanceName, objectName, 'us_EN');

    const object = byString(processDescription, parameter.parameterUrl);
    var offsetObject = object.offsetSharedMemory;
    const OffsetManagementBuffer = 12;
    // double buffered shared memory
    //const size = 2 * LengthSharedMemory + OffsetManagementBuffer; //748
    const doubleBuffer = processDescription.doubleBuffer;
    const keyFromDescription = processDescription.key;
    const LengthSharedMemory = processDescription.sizeOfSharedMemory;
    const size = doubleBuffer ? 2 * LengthSharedMemory + OffsetManagementBuffer : LengthSharedMemory;

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
        const activeWriteBuffer = buf.readUInt32LE(4);
        const offset = OffsetManagementBuffer + activeWriteBuffer * LengthSharedMemory;

        let value;

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
            buf.writeInt16LE(processValue, offsetObject + offset);
        }
        else if (object.type == 'UnsignedShortInteger') {
            buf.writeUInt16LE(processValue, offsetObject + offset);
        }
        else if (object.type == 'Integer') {
            buf.writeInt32LE(processValue, offsetObject + offset);
        }
        else if (object.type == 'UnsignedInteger') {
            buf.writeUInt32LE(processValue, offsetObject + offset);
        }
        else if (object.type == 'LongLong') {
            buf.writeInt64LE(processValue, offsetObject + offset);
        }
        else if (object.type == 'UnsignedLongLong') {
            buf.writeUInt64LE(processValue, offsetObject + offset);
        }
        else if (object.type == 'Double') {
            buf.writeDoubleLE(processValue, offsetObject + offset);
        }
        else if (object.type == 'Float') {
            buf.writeFloatLE(processValue, offsetObject + offset);
        }
        else if (object.type == 'Boolean') {
            buf.writeInt32LE(processValue, offsetObject + offset);
        }
        else if (object.type == 'Bit') {
            throw new Error('writing process values: unhandled type: Bit');
        }
        else if (object.type == 'String') {
            buf.write(processValue, offsetObject + offset)
        }
        else if (object.type == 'Selection') {
            buf.write(processValue, offsetObject + offset)
        }
        else if (object.type == 'Selector') {
            buf.write(processValue, offsetObject + offset)
        }

        memory.write(buf);

        return Promise.resolve();

    } catch (e) {
        console.error(e);
        return Promise.reject();

    }
}