import { getProcessDataDescription } from './providerHandler.js';
import { write } from './writeProcessValues.js';

/**
 * Sets the PlcActive flags by retrieving all existing PlcActive selectors,
 * creating a list of selector-value pairs, and writing them to true. This
 * is nessessary to enable controller modules, placed on the JUMO variTRON
 * system via EtherCAT. The function should be called only once after the
 * system is started.
 * @returns {Promise<void>} A promise that resolves when the flags are set.
 */
const setPlcActiveFlags = async () => {
    // get all existing PlcActive selectors
    const selectors = await getPlcActiveFlagSelectors();

    // create a list of selector value pairs and write them
    const writeList = selectors.map((selector) => {
        return {
            selector,
            value: true
        };
    });
    await write(writeList);
};

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
 * Retrieves all selectors corresponding to the 'PlcActive' process value within the EtherCatGateway module.
 *
 * @returns {Promise<Array<string>>} - A promise that resolves to an array of PlcActive selectors.
 *
 * @description
 * This asynchronous function fetches the ProcessDataDescription for the specified module, instance, and object
 * via DBus. It then creates an object hierarchy from the process description and identifies all occurrences
 * of the 'PlcActive' process value within the structured description. The resulting array contains selectors
 * representing the locations of PlcActive in the hierarchy.
 */
const getPlcActiveFlagSelectors = async () => {
    const moduleName = 'EtherCatGateway';
    const objectName = 'ProcessData';
    const instanceName = 'AnalogModuleOutput';

    // Fetch ProcessDataDescription of EtherCatGateway via DBus
    const processDescription = await getProcessDataDescription(
        moduleName,
        instanceName,
        objectName,
        'us_EN');

    // Find all selectors corresponding to the 'PlcActive' process value
    const plcActiveSelectors = findAllMatchingSelectors(processDescription, { moduleName, instanceName, objectName }, []);
    return plcActiveSelectors;
};

/**
 * Recursively finds leaf objects with 'PlcActive' in the name and returns their selectors.
 *
 * @param {object} source - The source object to search for leaf objects.
 * @param {object} description - The description of the leaf objects with the module name, instance name, and object name.
 * @param {Array} objectPath - The current path in the object hierarchy.
 */
function findAllMatchingSelectors(source, description, objectPath) {
    const selectorList = [];

    // if a source is of type TreeNode, there are structures one stage deeper in the value property
    if (hasProperty(source, 'type') && source.type === 'TreeNode') {
        // recursive call this function with all structures
        for (const [key, value] of Object.entries(source.value)) {
            const nextPath = objectPath.concat(key);
            const matchingSelector = findAllMatchingSelectors(value, description, nextPath);
            if (matchingSelector.length > 0) selectorList.push(...matchingSelector);
        }
    }

    // collect all leafs with 'PlcActive' as last path element
    if (objectPath[objectPath.length - 1] == 'PlcActive') {
        const pathName = objectPath.join('/');
        selectorList.push(`ProcessData#${description.moduleName}#${description.objectName}#${description.instanceName}#${pathName}`);
    }

    return selectorList;
}

export {
    setPlcActiveFlags,
};
