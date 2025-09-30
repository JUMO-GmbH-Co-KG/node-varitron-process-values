import { native } from './importShm.js';

/**
 * Retrieves the process data description buffer entry for a specified module, instance, and object.
 *
 * @param {string} moduleName - The name of the module associated with the process data.
 * @param {string} instanceName - The name of the instance associated with the process data.
 * @param {string} objectName - The name of the object associated with the process data.
 * @param {Array} buffer - The buffer containing process data description entries.
 * @returns {Object|undefined} - The process data description entry if found; otherwise, undefined.
 *
 * @description
 * This function searches the provided buffer for an entry matching the specified module, instance, and object names.
 * If a matching entry is found, the associated process description is returned; otherwise, undefined is returned.
 */
export function getProcessDataDescriptionBuffer(moduleName, instanceName, objectName, buffer) {
    // Find the process data description entry in the buffer based on module, instance, and object names.
    const foundObject = buffer.find(obj =>
        obj.moduleName === moduleName &&
        obj.instanceName === instanceName &&
        obj.objectName === objectName
    );
    // Return the process data description if a matching entry is found; otherwise, return undefined.
    if (foundObject) {
        return foundObject.processDescription;
    } else {
        return undefined;
    }
}

/**
 * checks if the system version is at least 9
 * @param {*} cpveVersion - the version of the CPVE out of the process description
 * @returns {boolean} - true if the system version is at least 9
 */
function isSystemVersionAtLeast9(cpveVersion) {
    // "cpveVersion": "419.8.0.0.20"
    // Check if the major index is >= 8 (8 means v9 in this case)
    const version = cpveVersion.split('.');
    const majorVersion = parseInt(version[1], 10);
    return majorVersion >= 8;
}

/**
 * Get the buffer type out of the process description and respects the different buffer types between v8 and v9
 * @param {*} processDescription - the process description
 * @returns buffer type as string (singleBufferSemaphore, singleBufferSequenceLock, doubleBuffer)
 */
export function getBufferType(processDescription) {
    // v8:
    //   has processDescription.doubleBuffer that selects the buffer type
    // v9:
    //   has NO processDescription.doubleBuffer
    //   but processDescription.bufferType
    //   valid buffer types are: 'singleBufferSemaphore', 'singleBufferSequenceLock', 'doubleBuffer
    if (isSystemVersionAtLeast9(processDescription.cpveVersion)) {
        return processDescription.bufferType;
    }
    return processDescription.doubleBuffer ? 'doubleBuffer' : 'singleBufferSemaphore';
}

/**
 * Get the size of the management buffer for the different buffer types
 * @param {*} bufferType - the buffer type
 * @returns the size of the management buffer
 */
export function getSizeOfManagementBuffer(bufferType) {
    switch (bufferType) {
        case 'singleBufferSemaphore':
            // has no management buffer
            return 0;
        case 'singleBufferSequenceLock':
            // has the sequence number as management buffer
            // -> ProcessDataBufferHandler.cpp: ProcessDataBufferHandler::calculatePointerForSingleBufferWithSequenceLock()
            // -> SequenceLock.hpp: SingleBufferHandlerSequenceLock::getSizeManagementBuffer()
            // -> SequenceLock.hpp: using Sequence = unsigned int;) -> 4 bytes
            return 4;
        case 'doubleBuffer':
            // has a management buffer with two active buffers and a sequence number
            // -> ProcessDataBufferHandler.cpp: ProcessDataBufferHandler::calculatePointerForPingPongBuffer()
            // -> ProcessDataBufferHandler.hpp: PingPongBufferHandler::getSizeManagementBuffer()
            // -> PingPongBufferHandler.hpp:
            //    struct ck_sequence {
            //        unsigned int sequence;
            //    };
            //    enum class ActiveBuffer{
            //        buffer1,
            //        buffer2
            //    };
            //    struct ManagementBuffer {
            //        ActiveBuffer activeReadBuffer;    -> 4 bytes
            //        ActiveBuffer activeWriteBuffer;   -> 4 bytes
            //        ck_sequence_t seqlock;            -> 4 bytes
            //    };
            return 12;
        default:
            return 0;
    }
}

/**
 * Calculate the size of the complete shared memory including management buffer and offset
 * @param {*} bufferType - the type of the buffer
 * @param {*} sizeOfSingleSharedMemory - the size of the single shared memory
 * @param {*} offsetSharedMemory - the offset of the shared memory
 * @returns the size of the complete shared memory
 */
function calculateSharedMemorySize(bufferType, sizeOfSingleSharedMemory, offsetSharedMemory) {
    // some buffer types have a management buffer at the beginning of the shared memory
    const sizeOfManagementBuffer = getSizeOfManagementBuffer(bufferType);

    // the size of the complete shared memory is the size of the shared memory + the size of the management buffer. in case of a double buffer the size of the is doubled.
    // since v9 we have also take the offset into account. we have to attach to the complete shared memory, including the offset because the offsets of the process values
    // are calculated from the beginning of the shared memory (including the offsetSharedMemory).
    return offsetSharedMemory + sizeOfManagementBuffer + (sizeOfSingleSharedMemory * (bufferType === 'doubleBuffer' ? 2 : 1));
}

/**
 * Get the start address of the current buffer
 * @param {*} processDescription - the process description
 * @param {*} buf - the buffer
 * @returns the start address of the current buffer
 */
export function getCurrentBufferStartAddress(processDescription, buf) {
    // the buffer start address is the part behind the management buffer WITHOUT the offsetSharedMemory, because the offsetSharedMemory is already included
    // in the offset of the process values.
    const bufferType = getBufferType(processDescription);
    const isDoubleBuffer = bufferType === 'doubleBuffer';
    const sizeOfManagementBuffer = getSizeOfManagementBuffer(bufferType);
    const sizeOfSingleSharedMemory = processDescription.sizeOfSharedMemory;

    if (isDoubleBuffer) {
        // get the active read buffer out of the management buffer (0 or 1)
        const activeReadBuffer = buf.readUInt32LE(0);
        const startAddress = sizeOfManagementBuffer + (activeReadBuffer * sizeOfSingleSharedMemory);
        return startAddress;
    }
    const startAddress = sizeOfManagementBuffer;
    return startAddress;
}

/**
 * Attaches to a shared memory segment based on the provided process description.
 * Caches shared memory objects to avoid redundant attachments.
 *
 * @param {Object} processDescription - The process description containing details for shared memory attachment.
 * @returns {Object} - The attached shared memory object.
 *
 * @description
 * This function checks if a shared memory object with the same key and offset already exists in the cache.
 * If it does, it returns the cached object. Otherwise, it creates a new shared memory object, stores it in the cache,
 * and then returns the new object.
 */
export function attachToSharedMemory(processDescription) {
    // create cache for shared memory objects if not already existing
    if (typeof attachToSharedMemory.cache === 'undefined') {
        attachToSharedMemory.cache = new Map();
    }

    const sharedMemoryKey = processDescription.key;
    const shmKey = sharedMemoryKey + 'SharedMemory';
    const offsetSharedMemory = processDescription.offsetSharedMemory || 0;

    // create a unique cache key based on the shared memory key and offset, because we can have multiple shared
    // memory segments with the same key but different offsets
    const cacheKey = `${shmKey}_${offsetSharedMemory}`;

    // if we have the same shared memory key and offset, we can reuse the existing shared memory object
    if (attachToSharedMemory.cache.has(cacheKey)) {
        return attachToSharedMemory.cache.get(cacheKey);
    }

    // create new shared memory object and store it in the cache
    const newMemory = createSharedMemoryObject(processDescription, sharedMemoryKey, shmKey, offsetSharedMemory);
    attachToSharedMemory.cache.set(cacheKey, newMemory);
    return newMemory;
}

/**
 * Creates a new shared memory object.
 * @param {*} processDescription - The process description containing details for shared memory creation.
 * @param {*} sharedMemoryKey - The key for the shared memory.
 * @param {*} shmKey - The shared memory key.
 * @param {*} offsetSharedMemory - The offset for the shared memory.
 * @returns {*} - The created shared memory object.
 */
function createSharedMemoryObject(processDescription, sharedMemoryKey, shmKey, offsetSharedMemory) {
    // v8:
    //   has processDescription.doubleBuffer that selects the buffer type
    // v9:
    //   has NO processDescription.doubleBuffer
    //   if it is no double buffer, it has NO processDescription.doubleBuffer but processDescription.bufferType
    //   valid buffer types are: 'singleBufferSemaphore', 'singleBufferSequenceLock', 'doubleBuffer'
    const bufferType = getBufferType(processDescription);
    const isDoubleBuffer = bufferType === 'doubleBuffer';
    const sizeOfSingleSharedMemory = processDescription.sizeOfSharedMemory;

    // calculate the size of the complete shared memory
    const completeSizeSharedMemory = calculateSharedMemorySize(bufferType, sizeOfSingleSharedMemory, offsetSharedMemory);

    // @todo: do we need this for the 'singleBufferSequenceLock' buffer type?
    const semaphoreKey = `${sharedMemoryKey}Semaphore${isDoubleBuffer ? 'WriteLock' : 'BufferLock'}`;

    // creationType = attachToExistingLock = 0 - we always attach to an existing lock
    const creationType = 0;

    //console.log(`attachToSharedMemory() ${shmKey}, bufferType: ${processDescription.bufferType}, singleSize: ${sizeOfSingleSharedMemory}, offsetSharedMemory: ${offsetSharedMemory}`);

    return new native.SharedMemory(shmKey, completeSizeSharedMemory, isDoubleBuffer, semaphoreKey, creationType);
}
