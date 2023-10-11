import { getProcessDataDescription } from './systemInformationManager.js';
import { getModuleName, getInstanceName, getObjectName, getObjectFromUrl, byString } from "./processValueUrl.js";
import { createHash } from 'crypto';
import { statSync } from 'fs';

import { shared_memory } from './importShm.js';



export async function read(processValueUrl) {

    const moduleName = getModuleName(processValueUrl);
    const instanceName = getInstanceName(processValueUrl);
    const objectName = getObjectName(processValueUrl);

    const parameter = getObjectFromUrl(processValueUrl);
    const processDescription = await getProcessDataDescription(moduleName, instanceName, objectName, 'us_EN');

    const object = byString(processDescription, parameter.parameterUrl);
    var offsetObject = object.offsetSharedMemory;

    let buffer;

    const OffsetManagementBuffer = 12;
    // double buffered shared memory
    //const size = 2 * LengthSharedMemory + OffsetManagementBuffer; //748
    const doubleBuffer = processDescription.doubleBuffer;
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

    try {

        const memory = new shared_memory(shmKey, size, doubleBuffer);

        // Read the data into a buffer
        const buf = memory.buffer;


        const activeReadBuffer = buf.readUInt32LE(0);
        //const activeWriteBuffer = buf.readUInt32LE(4);
        const offset = OffsetManagementBuffer + activeReadBuffer * LengthSharedMemory;

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
            value = buf.readInt16LE(offsetObject + offset);
        }
        else if (object.type == 'UnsignedShortInteger') {
            value = buf.readUInt16LE(offsetObject + offset);
        }
        else if (object.type == 'Integer') {
            value = buf.readInt32LE(offsetObject + offset);
        }
        else if (object.type == 'UnsignedInteger') {
            value = buf.readUInt32LE(offsetObject + offset);
        }
        else if (object.type == 'LongLong') {
            value = buf.readInt64LE(offsetObject + offset);
        }
        else if (object.type == 'UnsignedLongLong') {
            value = buf.readUInt64LE(offsetObject + offset);
        }
        else if (object.type == 'Double') {
            value = buf.readDoubleLE(offsetObject + offset);
        }
        else if (object.type == 'Float') {
            value = buf.readFloatLE(offsetObject + offset);
        }
        else if (object.type == 'Boolean') {

        }
        else if (object.type == 'Bit') {
        }

        else if (object.type == 'String') {
            let tmpbuffer = buffer.slice(offsetObject + offset, offsetObject + offset + object.sizeValue);
            value = tmpbuffer.toString();
        }
        else if (object.type == 'Selection') {
            let tmpbuffer = buffer.slice(offsetObject + offset, offsetObject + offset + object.sizeValue);
            value = tmpbuffer.toString();
        }
        else if (object.type == 'Selector') {
            let tmpbuffer = buffer.slice(offsetObject + offset, offsetObject + offset + object.sizeValue);
            value = tmpbuffer.toString();
        }

        const result = {
            "url": processValueUrl,
            "value": value,
            "unit": object.measurementRangeAttributes[0].unitText.POSIX,
        }

        // const batteryStatus = `${buf.readUInt32LE(OffsetBatteryStatus + offset) == 1 ? 'Ok' : 'Replace'}`;

        // const rootFsFreeSpace = `${(buf.readDoubleLE(OffsetRootFs + offset) / 1024 / 1024).toFixed(2)} GB`;

        // const freeRam = `${(buf.readDoubleLE(OffsetRamAvailable + offset) / 1024 / 1024).toFixed(2)} GB`;

        // const cpuTemp = `${buf.readDoubleLE(OffsetTemperatureCpuInternal + offset)} °C`;

        return Promise.resolve(result);
    } catch (e) {
        console.error(e);
        return Promise.reject();
    }
};


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