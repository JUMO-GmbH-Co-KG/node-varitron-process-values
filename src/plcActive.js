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

const getPlcActiveFlagSelectors = async () => {
    const moduleName = 'EtherCatGateway';
    const objectName = 'ProcessData';
    const instanceName = 'AnalogModuleOutput';

    // get ProcessDataDescription of EtherCatGateway via DBus
    const processDescription = await getProcessDataDescription(
        moduleName,
        instanceName,
        objectName,
        'us_EN');

    // create object hierarchy from processDescription
    const structuredProcessDataDescription = createObjectHierarchy(processDescription, moduleName, instanceName, objectName);

    // find all PlcActive occurences in structuredProcessDataDescription
    // example: "selector": "ProcessData#EtherCatGateway#ProcessData#AnalogModuleOutput#CTR04_11/BinarySystemOutputs/PlcActive",
    const plcActiveSelectors = [];
    const processDataDescriptionString = JSON.stringify(structuredProcessDataDescription);
    const plcActiveRegex = /"selector"\s*:\s*"(?<selector>[^"]*BinarySystemOutputs\/PlcActive)"/g;
    let match;
    while ((match = plcActiveRegex.exec(processDataDescriptionString)) !== null) {
        // This is necessary to avoid infinite loops with zero-width matches
        if (match.index === plcActiveRegex.lastIndex) {
            plcActiveRegex.lastIndex++;
        }

        plcActiveSelectors.push(match.groups.selector);
    }

    return plcActiveSelectors;
};

export {
    setPlcActiveFlags
};
