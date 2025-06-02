import { getRegisteredProvidersList, getListOfInstances } from './systemInformationManager.js';
import { getProcessDataDescription } from './providerHandler.js';

/**
 * Checks if an object has a property.
 *
 * @param {object} obj - The object.
 * @param {string} prop - The property name.
 * @returns {boolean} - True if the object has the property, false otherwise.
 */
function hasProperty(obj, prop) {
    return Object.prototype.hasOwnProperty.call(obj, prop);
}

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
        throw new Error(`Can't get provider list: ${e}`);
    }
    return modules;
}

/**
 * Retrieves a list of possible process values from all available modules of the JUMO variTRON system.
 *
 * @returns {Promise<Array>} A promise that resolves to an array of modules and their associated process values.
 * @throws {Error} If there is an error retrieving the list of process values.
*/
// eslint-disable-next-line max-statements
export async function getList() {
    // return provider list from cache if available
    if (typeof getList.providerCache !== 'undefined') {
        return getList.providerCache;
    }

    let moduleList = [];
    try {
        moduleList = await getProcessValueProvidingModules();
    } catch (e) {
        throw new Error(`Unable to getProcessValueProvidingModules: ${e}`);
    }

    const providerList = [];
    for (const module of moduleList) {
        const result = [];
        try {
            // get all instances of a module
            const instanceList = await getListOfInstances(module.moduleName, module.objectName, 'us_EN');

            //result = [];
            for (const instance of instanceList) {
                const activeInstances = await recursiveFindInstance(instance);
                result.push(...activeInstances);
            }
        } catch (e) {
            console.log(`Error while processing module ${module.moduleName}: ${e}`);
        }

        // keep only modules with instances because we don't want to see modules without process values
        if (result.length > 0) {
            providerList.push({
                moduleName: module.moduleName,
                objectName: module.objectName,
                instances: result,
            });
        }
    }
    getList.providerCache = providerList;
    return providerList;
}

// filter out modules and instances that should not be shown because they are invalid, useless or for internal use only
const instanceBlocklist = [
    { moduleName: 'EtherCatGateway', instanceNameRegExp: /\d{6}\/\w+Selector/ },  // All instances of EtherCatGateway with a name like 705020/OutputSelector are not accessable
    { moduleName: 'EtherCatGateway', instanceNameRegExp: /Initialization$/ },     // Initialization are for internal use only
    { moduleName: 'EtherCatGateway', instanceNameRegExp: /Initialization/ },      // Initialization are for internal use only (v9)
    { moduleName: 'RealTimeScheduler', instanceNameRegExp: /DebugData$/ },        // DebugData is for internal use only
    { moduleName: 'RealTimeScheduler', instanceNameRegExp: /ThreadData$/ },       // ThreadData is for internal use only
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
// eslint-disable-next-line max-statements
async function recursiveFindInstance(instance) {
    // if instance has a substructure, recursive call recursiveFindInstance for each substructure
    if (hasProperty(instance, 'substructure')) {
        const filteredSubInstances = [];
        // process each substucture after another to avoid parallel dbus calls
        for (const subInstance of instance.substructure) {
            const result = await recursiveFindInstance(subInstance);

            // add flat list of subinstances to to our list, if there are any
            if (result.length > 0) filteredSubInstances.push(...result);
        }
        return filteredSubInstances;
    }

    // process the leaf instance
    const { moduleName, instanceName, objectName } = instance;

    // filter out modules without instance or object (wtrans gateway has such a thing) or blacklisted instances
    // this prefiltering should reduce the amount of dbus calls
    if (!instanceName || !objectName || instanceBlocklist.some(entry => entry.moduleName === moduleName && entry.instanceNameRegExp.test(instanceName))) {
        return [];
    }

    try {
        const processDataDescription = await getProcessDataDescription(moduleName, instanceName, objectName, 'us_EN');

        const structuredProcessDataDescription = {};
        recursiveFindLeafObjects(structuredProcessDataDescription, processDataDescription, { moduleName, instanceName, objectName }, []);

        // return only, if structuredProcessDataDescription has elements
        if (Object.keys(structuredProcessDataDescription).length > 0) {
            return [{
                name: instanceName,
                values: structuredProcessDataDescription,
            }];
        } else {
            return [];
        }
    } catch (error) {
        const errMsg = `Can't get ProcessDataDescription for module: ${moduleName},  instance: ${instanceName}, object: ${objectName}: ${error}`;
        throw new Error(errMsg);
    }
}

/**
 * Sets a deep property in an object based on a given path.
 *
 * @param {object} destination - The object to set the property in.
 * @param {Array} path - The path to the property.
 * @param {any} obj - The value to set.
 */
function setDeepProperty(destination, path, obj) {
    let currentLevel = destination;
    path.forEach((key, index) => {
        if (!currentLevel[key]) {
            currentLevel[key] = index === path.length - 1 ? obj : {};
        }
        currentLevel = currentLevel[key];
    });
}

// filter out leafs that should not be shown because they are invalid, useless or for internal use only
const leafObjectBlocklist = [
    { moduleName: 'EtherCatGateway', object: /[d|D]ummy/ },           // Dummy objects are for internal use only
    { moduleName: 'EtherCatGateway', object: /Free\d{3}/ },           // Objects like Free000 are only placeholders
    { moduleName: 'EtherCatGateway', object: /NotCalibrated/ },       // NotCalibrated objects are for internal use only
    { moduleName: 'EtherCatGateway', object: /Calib/ },               // Calib objects are for internal use only
    { moduleName: 'EtherCatGateway', object: /ErrorCode/ },           // ErrorCode objects are for internal use only
    { moduleName: 'EtherCatGateway', object: /Logentry/ },            // Logentry objects are for internal use only
    { moduleName: 'EtherCatGateway', object: /NotUsed/ },             // NotUsed objects are not used (v9)
    { moduleName: 'EtherCatGateway', object: /^1$/ },                 // Objects like 1 are for internal use only (v9)
    { moduleName: 'EtherCatGateway', object: /^2$/ },                 // Objects like 2 are for internal use only (v9)
];

/**
 * Recursively finds leaf objects in a source object and adds them to a destination object hierarchy.
 *
 * @param {object} destination - The destination object hierarchy.
 * @param {object} source - The source object to search for leaf objects.
 * @param {object} description - The description of the leaf objects with the module name, instance name, and object name.
 * @param {Array} objectPath - The current path in the object hierarchy.
 */
function recursiveFindLeafObjects(destination, source, description, objectPath) {
    // filter out leafs that should not be shown because they are invalid, useless or for internal use only
    if (leafObjectBlocklist.some(entry => entry.moduleName === description.moduleName && entry.object.test(objectPath[objectPath.length - 1]))) {
        return;
    }

    // if a source is of type TreeNode, there are structures one stage deeper in the value property
    if (hasProperty(source, 'type') && source.type === 'TreeNode') {
        // recursive call this function with all structures
        for (const [key, value] of Object.entries(source.value)) {
            const nextPath = objectPath.concat(key);
            recursiveFindLeafObjects(destination, value, description, nextPath);
        }
        return;
    }

    // leafs with 'offsetSharedMemory' property are process values but can contain internal data that should not be visible
    // @todo: use 'selectorTypeListEndpoint' instead. problem: the outputs of ethercat modules have no
    //        'selectorTypeListEndpoint' property. This will be coming probably in a future version of the variTRON.
    if (hasProperty(source, 'offsetSharedMemory')) {
        // pathName is the path to the element as a string, divided by '/'
        const pathName = objectPath.join('/');

        // if we use array indices in the path, we need to replace them with '#value[index]'
        // pathName = pathName.replace(/\[(\d+)\]/g, '#value[$1]');

        // add unit if unit is available
        const unit = hasProperty(source, 'measurementRangeAttributes') ? source.measurementRangeAttributes[0].unitText.POSIX : '';

        setDeepProperty(destination, objectPath, {
            name: source.labelText,
            selector: `ProcessData#${description.moduleName}#${description.objectName}#${description.instanceName}#${pathName}`,
            type: source.type,
            readOnly: source.readOnly,
            unit
        });
    }
}
