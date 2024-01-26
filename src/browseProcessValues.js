import { getRegisteredProvidersList, getListOfInstances } from './systemInformationManager.js';
import { getProcessDataDescription } from './providerHandler.js';

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

/*
* function: findInstance
*/
// eslint-disable-next-line max-statements, complexity
async function recursiveFindInstance(instance) {
    const result = [];
    if (Object.prototype.hasOwnProperty.call(instance, 'substructure')) {
        for (const element of instance.substructure) {
            const subResult = await recursiveFindInstance(element);
            result.push(...subResult);
        }
    } else {
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
            const processDataDescription = await getProcessDataDescription(moduleName, instanceName, objectName, 'us_EN');
            const structuredProcessDataDescription = createObjectHierarchy(processDataDescription, moduleName, instanceName, objectName);
            const object = {
                name: instanceName,
                values: structuredProcessDataDescription,
            };
            result.push(object);
        } catch (error) {
            const errMsg = `Can't get ProcessDataDescription for module: ${moduleName},  instance: ${instanceName}, object: ${objectName}: ${error}`;
            return Promise.reject(new Error(errMsg));
        }
    }
    return result;
}

/*
* function: createObjectHierarchy
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
