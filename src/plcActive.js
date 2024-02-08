import { getProcessDataDescription } from './providerHandler.js';
import { createObjectHierarchy } from './browseProcessValues.js';
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
 * Retrieves all selectors corresponding to the 'PlcActive' process value within the EtherCatGateway module.
 *
 * @returns {Promise<Array<string>>} - A promise that resolves to an array of PlcActive selectors.
 *
 * @description
 * This asynchronous function fetches the ProcessDataDescription for the specified module, instance, and object
 * via DBus. It then creates an object hierarchy from the process description and identifies all occurrences
 * of the 'PlcActive' process value within the structured description. The resulting array contains selectors
 * representing the locations of PlcActive in the hierarchy.
 *
 * @example
 * // Example usage:
 * const plcActiveSelectors = await getPlcActiveFlagSelectors();
 * console.log(plcActiveSelectors);
 * // Output: ["ProcessData#EtherCatGateway#ProcessData#AnalogModuleOutput#CTR04_11/BinarySystemOutputs/PlcActive"]
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

    // Create object hierarchy from processDescription
    const structuredProcessDataDescription = createObjectHierarchy(processDescription, moduleName, instanceName, objectName);
    const processDataDescriptionString = JSON.stringify(structuredProcessDataDescription);

    // get all PlcActive selectors
    const plcActiveRegex = /"selector"\s*:\s*"(?<selector>[^"]*BinarySystemOutputs\/PlcActive)"/g;
    const plcActiveSelectors = Array.from(
        processDataDescriptionString.matchAll(plcActiveRegex),
        match => match.groups.selector
    );

    return plcActiveSelectors;
};

export {
    setPlcActiveFlags,
};
