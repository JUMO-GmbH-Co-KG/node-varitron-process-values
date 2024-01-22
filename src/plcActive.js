import { getProcessDataDescription } from './providerHandler.js';
import { createObjectHierarchy } from './browseProcessValues.js';
import { write } from './writeProcessValues.js';

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
