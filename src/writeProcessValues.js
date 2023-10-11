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


}