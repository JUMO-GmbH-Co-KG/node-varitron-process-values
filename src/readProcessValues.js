import { getProcessDataDescription } from './systemInformationManager.js';
import { getModuleName, getInstanceName, getObjectName, getObjectFromUrl } from "./processValueUrl.js";
//import { native } from './build/Release/shared_memory';

export async function read(processValueUrl) {

    const moduleName = getModuleName(processValueUrl);
    const instanceName = getInstanceName(processValueUrl);
    const objectName = getObjectName(processValueUrl);

    const parameter = getObjectFromUrl(processValueUrl);
    const processDescription = await getProcessDataDescription(moduleName, instanceName, objectName, 'us_EN');

    const object = Object.byString(processDescription, parameter.parameterUrl);
    var offset = object.offsetSharedMemory;

    let buffer;

    // double buffered shared memory
    //const size = 2 * LengthSharedMemory + OffsetManagementBuffer; //748
    const doubleBuffer = processDescription.doubleBuffer;
    const keyFromDescriptionJson = processDescription.key;
    const LengthSharedMemory = processDescription.sizeOfSharedMemory;
    const size = doubleBuffer ? 2 * LengthSharedMemory + OffsetManagementBuffer : LengthSharedMemory;
    console.log(doubleBuffer, keyFromDescriptionJson, LengthSharedMemory, size);

    // get shmKey by key from description file
    //const keyFromDescriptionJson = 'SystemObserverSystemObserver50085';
    const shmKeyNumber = getShmKeyByDescriptionKey(keyFromDescriptionJson);
    const shmKeyFixed = shmKeyNumber == -1 ? 0x5118001d : shmKeyNumber;
    const shmKey = '0x' + shmKeyFixed.toString(16);
    console.log('byDescKey: ' + shmKey + (shmKeyNumber == -1 ? ' (fixed)' : ''));

    console.log('attaching to shm...');

    try {

        //const memory = new native.shared_memory(shmKey, size);

        // Read the data into a buffer
        const buf = memory.buffer;
        const seqlock = buf.readUInt32LE(8);

        // Read data twice to check if seqlock has changed during read
        // const buf2 = memory.buffer;
        // const seqlock2 = buf2.readUInt32LE(8);

        // if (seqlock != seqlock2) {
        //     console.log('Different seqlock! Buffer has swaped during read... discard data!');
        //     return;
        // }

        const activeReadBuffer = buf.readUInt32LE(0);
        //const activeWriteBuffer = buf.readUInt32LE(4);
        const offset = OffsetManagementBuffer + activeReadBuffer * LengthSharedMemory;

        const batteryStatus = `${buf.readUInt32LE(OffsetBatteryStatus + offset) == 1 ? 'Ok' : 'Replace'}`;

        const rootFsFreeSpace = `${(buf.readDoubleLE(OffsetRootFs + offset) / 1024 / 1024).toFixed(2)} GB`;

        const freeRam = `${(buf.readDoubleLE(OffsetRamAvailable + offset) / 1024 / 1024).toFixed(2)} GB`;

        const cpuTemp = `${buf.readDoubleLE(OffsetTemperatureCpuInternal + offset)} °C`;

        return {
            batteryStatus,
            rootFsFreeSpace,
            freeRam,
            cpuTemp,
        };
    } catch (e) {
        console.error(e);
        return {};
    }
};

Object.byString = function (o, s) {
    s = s.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
    s = s.replace(/^\./, '');           // strip a leading dot
    var a = s.split('.');
    for (var i = 0, n = a.length; i < n; ++i) {
        var k = a[i];
        if (k in o) {
            o = o[k];
        } else {
            return;
        }
    }
    return o;
}