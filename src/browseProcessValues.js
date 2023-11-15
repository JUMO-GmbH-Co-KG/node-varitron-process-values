import { getRegisteredProvidersList, getListOfInstances, getProcessDataDescription } from './systemInformationManager.js';

export async function getProviderList() {
    const modules = [];
    const pvalues = [];
    try {
        const processdata = await getRegisteredProvidersList('us_EN', 'ProcessData');
        for (const pdata of processdata) {
            modules.push({ 'moduleName': pdata.moduleName, 'objectName': pdata.objectName });
        }
    } catch (e) {
        console.log('cant get RegisteredProviderList.' + e);
        return Promise.reject(e);
    }
    for (const mod of modules) {
        const instances = [];
        const module = {
            'moduleName': mod.moduleName,
            'objectName': mod.objectName,
            'instances': []
        };
        try {
            const instance = await getListOfInstances(mod.moduleName, mod.objectName, 'us_EN');
            instances.push(instance);
        } catch (e) {
            console.log('cant get list of instances for: ' + e);
            return Promise.reject(e);
        }
        for (const instance of instances) {
            try {
                for (let i = 0; i < instance.length; i++) {
                    async function findInstance(obj) {
                        if (Object.hasOwn(obj, 'substructure')) {
                            for (let i = 0; i < obj.substructure.length; i++) {
                                await findInstance(obj.substructure[i]);
                            }
                        } else {
                            const moduleName = obj.moduleName;
                            const instanceName = obj.instanceName;
                            const objectName = obj.objectName;
                            const value = await getProcessDataDescription(moduleName, instanceName, objectName, 'us_EN');

                            const values = await createObjectHierarchy(value, 'offsetSharedMemory', moduleName, instanceName, objectName);

                            const object = { 'name': instanceName, values };
                            module.instances.push(object);
                        }
                    }
                    await findInstance(instance[i]);
                }
            } catch (e) {
                console.log('cant get ProcessDescription for: ' + e);
                return Promise.reject(e);
            }
        }
        pvalues.push(module);
    }
    return Promise.resolve(pvalues);
}


/*
* function: createObjectHierarchy
*/
async function createObjectHierarchy(obj, propName, moduleName, instanceName, objectName) {
    const hierarchy = {};

    function addToHierarchy(path, objToAdd) {
        let currentLevel = hierarchy;
        path.forEach((key, index) => {
            if (!currentLevel[key]) {
                currentLevel[key] = index === path.length - 1 ? objToAdd : {};
            }
            currentLevel = currentLevel[key];
        });
    }

    function traverseObject(obj, currentPath) {
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                let newPath = currentPath.concat(key);
                const value = obj[key];

                if (typeof value === 'object') {
                    // Recursively traverse nested objects
                    traverseObject(value, newPath);
                } else if (key === propName) {
                    // If the property name matches, add the object to the hierarchy
                    let path = newPath.slice(0, -1).join('.');
                    path = path.replace(/value\./g, '');
                    path = path.replace(/\./g, '/');
                    path = path.replace(/\[(\d+)\]/g, '#value[$1]');
                    newPath = newPath.slice(0, -1);
                    const filteredArray = newPath.filter(item => item !== 'value');
                    const unit = Object.hasOwn(obj, 'measurementRangeAttributes') ? obj.measurementRangeAttributes[0].unitText.POSIX : '';
                    addToHierarchy(filteredArray, {
                        name: newPath[newPath.length - 1],
                        URL: 'ProcessData#' + moduleName + '#' + objectName + '#' + instanceName + '#' + path,
                        type: obj.type,
                        readOnly: obj.readOnly,
                        unit

                    });
                }
            }
        }
    }

    traverseObject(obj, []);

    return Promise.resolve(hierarchy);
}

