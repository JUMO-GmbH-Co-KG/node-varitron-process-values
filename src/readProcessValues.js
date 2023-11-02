import { getProcessDataDescription } from './systemInformationManager.js';
import { getModuleName, getInstanceName, getObjectName, getObjectFromUrl, byString } from "./processValueUrl.js";
import { createHash } from 'crypto';
import { statSync } from 'fs';

import { native } from './importShm.js';
import { isUtf8 } from 'buffer';



export async function read(processValueUrl) {


    if (Array.isArray(processValueUrl)) {
        // Parameter is an array
        let results = [];
        for (let procValueUrl of processValueUrl) {
            try {
                const result = await readFromUrl(procValueUrl);
                results.push(result);
            } catch (e) {
                console.error('cant read process value: ' + procValueUrl + '. ' + e);
            }

        }
        return Promise.resolve(results);
        //parameter is a Process value
    } else {
        try {
            const result = await readFromUrl(processValueUrl);
            return Promise.resolve(result);
        } catch (e) {
            console.error('cant read process value: ' + e);
            return Promise.reject('cant read process value');
        }
    }

    async function readFromUrl(processValueUrl) {
        // get parameters from processValueUrl
        const parameter = getObjectFromUrl(processValueUrl);
        // get ProcessDataDescription from DBus
        const processDescription = await getProcessDataDescription(
            parameter.moduleName,
            parameter.instanceName,
            parameter.objectName,
            'us_EN');

        //get object to read from processDescription
        const object = byString(processDescription, parameter.parameterUrl);
        //get offset from object in sharedMemory
        var offsetObject = object.offsetSharedMemory;
        //get offset from Metadata of the object in shared memory
        var offsetMetadata = object.offsetSharedMemory + object.relativeOffsetMetadata;

        /* the lengst from the ManagementBuffer (12 byte)
        *  0 = activeReadBuffer
        *  4 = activeWriteBuffer
        *  8 = seqlock (flag for buffer manipulation)
        */
        const OffsetManagementBuffer = 12;
        // is buffer doublebuffer
        const doubleBuffer = processDescription.doubleBuffer;
        //get key of shared memory from process description
        const keyFromDescription = processDescription.key;
        //get length of shared memory from process description
        const LengthSharedMemory = processDescription.sizeOfSharedMemory;
        //calculate the size of shared memory
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
            //create shared memory object in c++
            const memory = new native.shared_memory(shmKey, size, doubleBuffer, readSemaphore, 0);

            // Read the data into a buffer
            const buf = memory.buffer;

            //get the active read buffer from Management Buffer 
            const activeReadBuffer = doubleBuffer ? buf.readUInt32LE(0) : 0;
            //calculate general offset inside shared memory
            const offset = doubleBuffer ? OffsetManagementBuffer + activeReadBuffer * LengthSharedMemory : 0;

            let value;
            let metadata;

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
                if (object.sizeMetadata == 0) {
                    metadata = null;
                } else if (object.sizeMetadata == 4) {
                    metadata = buf.readUInt32LE(offsetMetadata + offset);
                }
            }
            else if (object.type == 'UnsignedShortInteger') {
                value = buf.readUInt16LE(offsetObject + offset);
                if (object.sizeMetadata == 0) {
                    metadata = null;
                } else if (object.sizeMetadata == 4) {
                    metadata = buf.readUInt32LE(offsetMetadata + offset);
                }
            }
            else if (object.type == 'Integer') {
                value = buf.readInt32LE(offsetObject + offset);
                if (object.sizeMetadata == 0) {
                    metadata = null;
                } else if (object.sizeMetadata == 4) {
                    metadata = buf.readUInt32LE(offsetMetadata + offset);
                }

            }
            else if (object.type == 'UnsignedInteger') {
                value = buf.readUInt32LE(offsetObject + offset);
                if (object.sizeMetadata == 0) {
                    metadata = null;
                } else if (object.sizeMetadata == 4) {
                    metadata = buf.readUInt32LE(offsetMetadata + offset);
                }
            }
            else if (object.type == 'LongLong') {
                value = buf.readBigInt64LE(offsetObject + offset);
                if (object.sizeMetadata == 0) {
                    metadata = null;
                } else if (object.sizeMetadata == 4) {
                    metadata = buf.readUInt32LE(offsetMetadata + offset);
                }
            }
            else if (object.type == 'UnsignedLongLong') {
                value = buf.readBigUInt64LE(offsetObject + offset);
                if (object.sizeMetadata == 0) {
                    metadata = null;
                } else if (object.sizeMetadata == 4) {
                    metadata = buf.readUInt32LE(offsetMetadata + offset);
                }
            }
            else if (object.type == 'Double') {
                value = buf.readDoubleLE(offsetObject + offset);
                if (object.sizeMetadata == 0) {
                    metadata = null;
                } else if (object.sizeMetadata == 4) {
                    metadata = buf.readUInt32LE(offsetMetadata + offset);
                }
            }
            else if (object.type == 'Float') {
                value = buf.readFloatLE(offsetObject + offset);
                //read out metadata from process value
                if (object.sizeMetadata == 0) {
                    if (value == 1e37) {
                        metadata = 1;
                    } else if (value == 2e37) {
                        metadata = 2;
                    } else if (value == 3e37) {
                        metadata = 3;
                    } else if (value == 4e37) {
                        metadata = 4;
                    } else if (value == 5e37) {
                        metadata = 5;
                    } else if (value == 6e37) {
                        metadata = 6;
                    } else if (value == 7e37) {
                        metadata = 7;
                    } else if (value == 8e37) {
                        metadata = 8;
                    } else if (value == 9e37) {
                        metadata = 9;
                    } else {
                        metadata = 0;
                    }
                } else if (object.sizeMetadata == 4) {
                    metadata = buf.readUInt32LE(offsetMetadata + offset);
                }
            }
            else if (object.type == 'Boolean') {
                if (object.sizeValue == 1) {
                    const tmpvalue = buf.readUInt8(offsetObject + offset);
                    value = tmpvalue != 0;
                } else if (object.sizeValue == 4) {
                    const tmpvalue = buf.readUInt32LE(offsetObject + offset);
                    value = tmpvalue != 0;
                }

                if (object.sizeMetadata == 0) {
                    metadata = null;
                } else if (object.sizeMetadata == 4) {
                    metadata = buf.readUInt32LE(offsetMetadata + offset);
                }
            }
            else if (object.type == 'Bit') {
                const tmpvalue = buf.readUInt8(offsetObject + offset);
                if (tmpvalue & object.bitMask) {
                    value = true;
                } else {
                    value = false;
                }
                metadata = null;
            }
            else if (object.type == 'String') {
                let tmpbuffer = buf.slice(offsetObject + offset, offsetObject + offset + object.sizeValue);
                value = tmpbuffer.toString();
                if (object.sizeMetadata == 0) {
                    metadata = null;
                } else if (object.sizeMetadata == 4) {
                    metadata = buf.readUInt32LE(offsetMetadata + offset);
                }
            }
            else if (object.type == 'Selection') {
                let tmpbuffer = buf.slice(offsetObject + offset, offsetObject + offset + object.sizeValue);
                value = tmpbuffer.toString();
                if (object.sizeMetadata == 0) {
                    metadata = null;
                } else if (object.sizeMetadata == 4) {
                    metadata = buf.readUInt32LE(offsetMetadata + offset);
                }
            }
            else if (object.type == 'Selector') {
                let tmpbuffer = buf.slice(offsetObject + offset, offsetObject + offset + object.sizeValue);
                value = tmpbuffer.toString();
                if (object.sizeMetadata == 0) {
                    metadata = null;
                } else if (object.sizeMetadata == 4) {
                    metadata = buf.readUInt32LE(offsetMetadata + offset);
                }
            }

            const result = {
                "url": processValueUrl,
                "value": value,
                "type": object.type,
                "readOnly": object.readOnly,
                "unit": object.measurementRangeAttributes?.[0]?.unitText?.POSIX || '',
                "metadata": metadata,
            }

            return Promise.resolve(result);
        } catch (e) {
            console.error(e);
            return Promise.reject('Cant read process value: ' + e);
        }
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