import { getRegisteredProvidersList, getListOfInstances } from './systemInformationManager.js';
import { getProcessDataDescription } from './providerHandler.js';

/**
 * Retrieves a list of modules providing process data based on the registered providers from dbus.
 *
 * @returns {Promise<Array<Object>>} - A promise that resolves with an array of objects containing moduleName and objectName.
 * @throws {Error} - Throws an error if there is an issue retrieving the registered providers list.
 *
 * @description
 * This asynchronous function retrieves the list of registered providers for process data in the specified language ('us_EN').
 * It extracts the moduleName and objectName from each provider entry and returns an array of objects containing this information.
 * If any issues occur during the process, an error is thrown with a descriptive message.
 *
 * @example
 * // Example usage:
 * try {
 *     const processValueProvidingModules = await getProcessValueProvidingModules();
 *     // Process the array of modules providing process data...
 * } catch (error) {
 *     // Handle the error...
 * }
 */
async function getProcessValueProvidingModules() {
    const modules = [];
    try {
        const providerList = await getRegisteredProvidersList('us_EN', 'ProcessData');
        for (const provider of providerList) {
            modules.push({ 'moduleName': provider.moduleName, 'objectName': provider.objectName });
        }
    } catch (e) {
        return Promise.reject(new Error(`Can't get provider list: ${e}`));
    }
    return Promise.resolve(modules);
}

//buffer for the provider list
let providerListBuffer;

/**
 * Retrieves a list of possible process values from all available modules of the JUMO variTRON system.
 * 
 * @returns {Promise<Array>} A promise that resolves to an array of modules and their associated process values.
 * @throws {Error} If there is an error retrieving the list of process values.
*/
// eslint-disable-next-line max-statements
export async function getList() {
    //if their is a providerListBuffer resolve to buffer
    if (providerListBuffer != undefined) {
        return Promise.resolve(providerListBuffer);
    }
    try {
        const moduleList = await getProcessValueProvidingModules();
        const providerList = [];
        for (const module of moduleList) {
            try {
                // get all instances of a module
                const instanceList = await getListOfInstances(module.moduleName, module.objectName, 'us_EN');

                const result = [];
                for (const instance of instanceList) {
                    try {
                        result.push(...await recursiveFindInstance(instance));
                    } catch (e) {
                        const errMsg = `Can't get ProcessDescription for: ${e}`;
                        return Promise.reject(new Error(errMsg));
                    }
                }

                // keep only modules with instances because we don't want to see modules without process values
                if (result.length > 0) {
                    providerList.push({
                        moduleName: module.moduleName,
                        objectName: module.objectName,
                        instances: result,
                    });
                }
            } catch (e) {
                return Promise.reject(new Error(`Can't get list of instances for ${module.moduleName}.${module.objectName}: ` + e));
            }
        }
        providerListBuffer = providerList;
        return Promise.resolve(providerList);
    } catch (e) {
        return Promise.reject(new Error(`Unable to getList: ${e}`));
    }
}

// filter out modules and instances that should not be shown because they are invalid, useless or for internal use only
const blacklist = [
    { moduleName: 'EtherCatGateway', instanceNameRegExp: /\d{6}\/\w+Selector/ },  // All instances of EtherCatGateway with a name like 705020/OutputSelector are not accessable
    { moduleName: 'EtherCatGateway', instanceNameRegExp: /Initialization$/ },     // Initialization are for internal use only
    { moduleName: 'RealTimeScheduler', instanceNameRegExp: /DebugData$/ },        // DebugData is for internal use only
    { moduleName: 'RealTimeScheduler', instanceNameRegExp: /ThreadData$/ }        // ThreadData is for internal use only
];

/**
 * Recursively finds and structures process data instances from a given instance object.
 *
 * @param {Object} instance - The instance object containing information about a module, instance, and substructure.
 * @returns {Promise<Array<Object>>} - A promise that resolves with an array of structured process data instances.
 * @throws {Error} - Throws an error if there is an issue retrieving the ProcessDataDescription or creating the object hierarchy.
 *
 * @description
 * This asynchronous function recursively traverses the provided instance object and extracts information about modules,
 * instances, and objects. It filters out entries without instance or object names and checks for blacklist entries.
 * For valid entries, it retrieves the ProcessDataDescription, creates a structured object hierarchy, and returns an array
 * of structured process data instances. If any issues occur during this process, an error is thrown with a descriptive message.
 *
 * @example
 * // Example usage:
 * const instanceData = {...}; // An instance object containing information about modules, instances, and substructure.
 * try {
 *     const structuredInstances = await recursiveFindInstance(instanceData);
 *     // Process the array of structured process data instances...
 * } catch (error) {
 *     // Handle the error...
 * }
 */
// eslint-disable-next-line max-statements, complexity
async function recursiveFindInstance(instance) {
    // Initialize the result array.
    const result = [];

    // Check if the instance has a 'substructure' property.
    if (Object.prototype.hasOwnProperty.call(instance, 'substructure')) {
        // Recursively process each element in the 'substructure'.
        for (const element of instance.substructure) {
            const subResult = await recursiveFindInstance(element);
            result.push(...subResult);
        }
    } else {
        // Extract module, instance, and object names from the instance.
        const moduleName = instance.moduleName;
        const instanceName = instance.instanceName;
        const objectName = instance.objectName;

        // filter out modules without instance or object (wtrans gateway has such a thing)
        if (!instanceName || !objectName) {
            return result;
        }

        // check if instance matches any blacklist entry
        if (blacklist.some(entry => entry.moduleName === moduleName && entry.instanceNameRegExp.test(instanceName))) {
            return result;
        }

        try {
            // Retrieve the ProcessDataDescription for the module, instance, and object.
            const processDataDescription = await getProcessDataDescription(moduleName, instanceName, objectName, 'us_EN');

            // Create a structured object hierarchy based on the ProcessDataDescription.
            const structuredProcessDataDescription = createObjectHierarchy(processDataDescription, moduleName, instanceName, objectName);

            // Create an object with the instance name and the structured process data description.
            const object = {
                name: instanceName,
                values: structuredProcessDataDescription,
            };
            // Push the object into the result array.
            result.push(object);
        } catch (error) {
            const errMsg = `Can't get ProcessDataDescription for module: ${moduleName},  instance: ${instanceName}, object: ${objectName}: ${error}`;
            return Promise.reject(new Error(errMsg));
        }
    }
    return result;
}

/**
 * Creates an usefull object hierarchy based on the provided object, moduleName, instanceName
 * and objectName. The hierarchy is built by recursively finding leaf objects that represent
 * process values and adding them to the hierarchy.
 * 
 * @param {object} obj - The source object to create the hierarchy from.
 * @param {string} moduleName - The name of the module.
 * @param {string} instanceName - The name of the instance.
 * @param {string} objectName - The name of the object.
 * @returns {object} - The created object hierarchy.
 */
export function createObjectHierarchy(obj, moduleName, instanceName, objectName) {
    function setDeepProperty(destination, path, obj) {
        let currentLevel = destination;
        path.forEach((key, index) => {
            if (!currentLevel[key]) {
                currentLevel[key] = index === path.length - 1 ? obj : {};
            }
            currentLevel = currentLevel[key];
        });
    }

    function recursiveFindLeafObjects(destination, source, objectPath) {
        for (const key in source) {
            if (Object.prototype.hasOwnProperty.call(source, key)) {
                const value = source[key];

                if (typeof value === 'object') {
                    const nextPath = objectPath.concat(key);
                    recursiveFindLeafObjects(destination, value, nextPath);
                } else if (key === 'offsetSharedMemory') {
                    // If the property name is 'offsetSharedMemory', add the object to the hierarchy

                    // last element in the path is the name of the element
                    const name = objectPath.slice(-1)[0];

                    // cleanPath is the path to the element without 'value' fields
                    const cleanPath = objectPath.filter(item => item !== 'value');

                    // pathName is the path to the element as a string, divided by '/'
                    const pathName = cleanPath.join('/');

                    // if we use array indices in the path, we need to replace them with '#value[index]'
                    // pathName = pathName.replace(/\[(\d+)\]/g, '#value[$1]');

                    // add unit if unit is available
                    const unit = Object.prototype.hasOwnProperty.call(source, 'measurementRangeAttributes') ? source.measurementRangeAttributes[0].unitText.POSIX : '';

                    setDeepProperty(destination, cleanPath, {
                        name,
                        selector: `ProcessData#${moduleName}#${objectName}#${instanceName}#${pathName}`,
                        type: source.type,
                        readOnly: source.readOnly,
                        unit
                    });
                }
            }
        }
    }

    // recursively cycle the source object, find leafs and add them to the destination object
    const processValueHierarchy = {};
    recursiveFindLeafObjects(processValueHierarchy, obj, []);
    return processValueHierarchy;
}
