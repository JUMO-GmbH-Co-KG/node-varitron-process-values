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
 *
 * @example
 * // Example usage:
 * const processDataBuffer = [...]; // An array containing process data description entries.
 * const processDescription = getProcessDataDescriptionBuffer('ModuleA', 'Instance1', 'ObjectX', processDataBuffer);
 * if (processDescription) {
 *     // Process the retrieved process description...
 * } else {
 *     // Handle the case where no matching entry is found...
 * }
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

export function attachToSharedMemory(processDescription, offsetManagementBuffer) {
    // create cache for shared memory objects if not already existing
    if (typeof attachToSharedMemory.cache === 'undefined') {
        attachToSharedMemory.cache = new Map();
    }

    const sharedMemoryKey = processDescription.key;
    const shmKey = sharedMemoryKey + 'SharedMemory';

    // return shared memory object out of cache if already existing or create new one
    return attachToSharedMemory.cache.get(shmKey) || (() => {
        const isDoubleBuffer = processDescription.doubleBuffer;
        const singleSizeSharedMemory = processDescription.sizeOfSharedMemory;
        const sizeSharedMemory = isDoubleBuffer ? 2 * singleSizeSharedMemory + offsetManagementBuffer : singleSizeSharedMemory;
        const semaphoreKey = `${sharedMemoryKey}Semaphore${isDoubleBuffer ? 'WriteLock' : 'BufferLock'}`;
        const creationType = 0; // attachToExistingLock

        const newMemory = new native.SharedMemory(shmKey, sizeSharedMemory, isDoubleBuffer, semaphoreKey, creationType);
        attachToSharedMemory.cache.set(shmKey, newMemory);
        return newMemory;
    })();
}
