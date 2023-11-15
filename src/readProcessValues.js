import { getProcessDataDescription } from './systemInformationManager.js';
import { getObjectFromUrl, byString } from './processValueUrl.js';

import { native } from './importShm.js';


export async function read(processValueUrl) {
    if (Array.isArray(processValueUrl)) {
        // Parameter is an array
        const results = [];
        for (const procValueUrl of processValueUrl) {
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
            return Promise.reject('cant read process value.' + e);
        }
    }
    
    //read function
    // eslint-disable-next-line max-statements, complexity
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
        const offsetObject = object.offsetSharedMemory;
        //get offset from Metadata of the object in shared memory
        const offsetMetadata = object.offsetSharedMemory + object.relativeOffsetMetadata;

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
        const shmKey = keyFromDescription + 'SharedMemory';
        console.log('byDescKey: ' + shmKey);

        console.log('attaching to shm...');
        //set semaphore name based on buffer type
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

            //processvalue
            let value;
            //metadata (errorcode)
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
                    metadata = getErrorCodeFromValue(value, object.type);
                } else if (object.sizeMetadata == 4) {
                    metadata = buf.readUInt32LE(offsetMetadata + offset);
                }
            }
            else if (object.type == 'Float') {
                value = buf.readFloatLE(offsetObject + offset);
                //read out metadata from process value
                if (object.sizeMetadata == 0) {
                    metadata = getErrorCodeFromValue(value, object.type);
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
                const tmpbuffer = buf.slice(offsetObject + offset, offsetObject + offset + object.sizeValue);
                value = tmpbuffer.toString();
                if (object.sizeMetadata == 0) {
                    metadata = null;
                } else if (object.sizeMetadata == 4) {
                    metadata = buf.readUInt32LE(offsetMetadata + offset);
                }
            }
            else if (object.type == 'Selection') {
                const tmpbuffer = buf.slice(offsetObject + offset, offsetObject + offset + object.sizeValue);
                value = tmpbuffer.toString();
                if (object.sizeMetadata == 0) {
                    metadata = null;
                } else if (object.sizeMetadata == 4) {
                    metadata = buf.readUInt32LE(offsetMetadata + offset);
                }
            }
            else if (object.type == 'Selector') {
                const tmpbuffer = buf.slice(offsetObject + offset, offsetObject + offset + object.sizeValue);
                value = tmpbuffer.toString();
                if (object.sizeMetadata == 0) {
                    metadata = null;
                } else if (object.sizeMetadata == 4) {
                    metadata = buf.readUInt32LE(offsetMetadata + offset);
                }
            }

            const errorText = getErrorText(metadata);

            const result = {
                'url': processValueUrl,
                value,
                'type': object.type,
                'readOnly': object.readOnly,
                'unit': object.measurementRangeAttributes?.[0]?.unitText?.POSIX || '',
                'error': {
                    'errorCode': metadata,
                    errorText
                }
            };

            return Promise.resolve(result);
        } catch (e) {
            console.error(e);
            return Promise.reject('Cant read process value: ' + e);
        }
    }
}

/*
* function: getErrorText
* function to resolve a errorCode to a errorText
*/
// eslint-disable-next-line complexity
function getErrorText(metadata) {
    if (metadata == null) {
        return '';
    }
    else if (metadata == 0) {
        return 'valid';
    }
    else if (metadata == 1) {
        return 'underrange';
    }
    else if (metadata == 2) {
        return 'overrange';
    }
    else if (metadata == 3) {
        return 'noValidInputValue';
    }
    else if (metadata == 4) {
        return 'divisionByZero';
    }
    else if (metadata == 5) {
        return 'incorrectMathematicValue';
    }
    else if (metadata == 6) {
        return 'invalidTemperature';
    }
    else if (metadata == 7) {
        return 'sensorShortCircuit';
    }
    else if (metadata == 8) {
        return 'sensorBreakage';
    }
    else if (metadata == 9) {
        return 'timeout';
    }
    else {
        return '';
    }
}
/*
* function: getErrorCodeFromValue
* function to resolve a errorCode from ProcessValue (Double,Float)
*/
// eslint-disable-next-line max-statements, complexity
function getErrorCodeFromValue(value, type) {
    //handling of floats
    if (type == 'Float') {
        if (value == 1e37) {
            return 1;
        } else if (value == 2e37) {
            return 2;
        } else if (value == 3e37) {
            return 3;
        } else if (value == 4e37) {
            return 4;
        } else if (value == 5e37) {
            return 5;
        } else if (value == 6e37) {
            return 6;
        } else if (value == 7e37) {
            return 7;
        } else if (value == 8e37) {
            return 8;
        } else if (value == 9e37) {
            return 9;
        } else {
            return 0;
        }
    }
    //handling of doubles
    if (type == 'Double') {
        const nanValue = extractNaNPayload(value);

        if (nanValue == '1') {
            return 1;
        } else if (nanValue == '2') {
            return 2;
        } else if (nanValue == '3') {
            return 3;
        } else if (nanValue == '4') {
            return 4;
        } else if (nanValue == '5') {
            return 5;
        } else if (nanValue == '6') {
            return 6;
        } else if (nanValue == '7') {
            return 7;
        } else if (nanValue == '8') {
            return 8;
        } else if (nanValue == '9') {
            return 9;
        } else {
            return 0;
        }
    }
    return 0;
}

//function to extract NaN Payload from double value
//@todo: muss noch getestet werden
function extractNaNPayload(doubleValue) {
    const buffer = Buffer.alloc(8); // Allocate buffer of 8 bytes
    buffer.writeDoubleLE(doubleValue, 0); // Write the double value to the buffer

    const uint64View = new BigUint64Array(buffer.buffer); // Create a view to interpret the buffer as a BigInt
    const uint64Value = uint64View[0]; // Get the 64-bit unsigned integer representation

    const exponent = (uint64Value >> 52n) & 0x7ffn; // Extract exponent bits
    const mantissa = uint64Value & 0xfffffffffffffn; // Extract mantissa bits

    if (exponent === 0x7ffn) {
        // If the exponent bits are all 1s (indicating a NaN)
        if (mantissa !== 0n) {
            // If the mantissa is non-zero, it's a payload NaN
            return mantissa.toString(16);
        } else {
            return 'Standard NaN'; // No payload in the NaN
        }
    } else {
        return 'Not a NaN'; // The value is not NaN
    }
}
