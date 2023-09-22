import { getRegisteredProvidersList, getListOfInstances, getProcessDataDescription } from './systemInformationManager.js';

export async function getProviderList() {
    let modules = [];
    let instances = [];
    let pvalues = [];
    try {
        const processdata = await getRegisteredProvidersList('us_EN', 'ProcessData');
        for (let pdata of processdata) {
            modules.push(pdata.moduleName);
        }
    } catch (e) {
        console.log('cant get RegisteredProviderList.' + e);
    }
    for (let mod of modules) {
        try {
            const instance = await getListOfInstances(mod, 'us_EN');
            instances.push(instance);
        } catch (e) {
            console.log('cant get list of instances for: ' + e);
        }

    }
    for (let instance of instances) {
        try {
            const moduleName = instance[0].moduleName;
            const instanceName = instance[0].instanceName;
            const value = await getProcessDataDescription(moduleName, instanceName, 'us_EN');
            pvalues.push(value);
        } catch (e) {
            console.log('cant get ProcessDescription for: ' + e);
        }
    }
    return Promise.resolve(pvalues);

}
async function parseProviderList() {

}
