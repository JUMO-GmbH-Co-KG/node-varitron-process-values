import { getRegisteredProvidersList, getListOfInstances, getProcessDataDescription } from './systemInformationManager.js';

export async function getProviderList() {
    let modules = [];
    let pvalues = [];
    try {
        const processdata = await getRegisteredProvidersList('us_EN', 'ProcessData');
        for (let pdata of processdata) {
            if (pdata.objectName === 'ProcessData') {

                modules.push(pdata.moduleName);

            }
        }
    } catch (e) {
        console.log('cant get RegisteredProviderList.' + e);
    }
    for (let mod of modules) {
        let instances = [];
        let module = {
            "modulName": mod,
            "instances": []
        }
        try {
            const instance = await getListOfInstances(mod, 'us_EN');
            instances.push(instance);
        } catch (e) {
            console.log('cant get list of instances for: ' + e);
        }
        for (let instance of instances) {
            try {
                for (let i = 0; i < instance.length; i++) {

                    if (Object.hasOwn(instance[i], 'substructure')) {

                        for (let j = 0; j < instance[i].substructure.length; j++) {
                            const moduleName = instance[i].substructure[j].moduleName;
                            const instanceName = instance[i].substructure[j].instanceName;
                            const value = await getProcessDataDescription(moduleName, instanceName, 'us_EN');

                            let values = findObjectsWithProperty(value, 'offsetSharedMemory', [])

                            let object = { "name": instanceName, "value": values };


                            module.instances.push(object);

                        }

                    } else {
                        const moduleName = instance[i].moduleName;
                        const instanceName = instance[i].instanceName;
                        const value = await getProcessDataDescription(moduleName, instanceName, 'us_EN');

                        let values = findObjectsWithProperty(value, 'offsetSharedMemory', [])

                        let object = { "name": instanceName, "value": values };

                        module.instances.push(object);
                    }

                }

            } catch (e) {
                console.log('cant get ProcessDescription for: ' + e);
            }
        }
        pvalues.push(module);

    }

    return Promise.resolve(pvalues);

}
async function parseProviderList() {

}

// export function getObjectPaths(obj, parentPath = '') {
//     const paths = [];

//     for (const key in obj) {
//         if (obj.hasOwnProperty(key)) {
//             const value = obj[key];
//             const currentPath = parentPath ? `${parentPath}.${key}` : key;

//             if (typeof value === 'object' && !Array.isArray(value)) {
//                 // If the current value is an object, recursively call the function
//                 paths.push(currentPath);
//                 const nestedPaths = getObjectPaths(value, currentPath);
//                 paths.push(...nestedPaths);
//             }
//         }
//     }

//     return paths;
// }

export function getObjectPaths(obj, parentPath = '', modulname, instancename) {
    const paths = [];
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const value = obj[key];
            let currentPath = parentPath ? `${parentPath}.${key}` : key;

            if (typeof value === 'object' && !Array.isArray(value)) {
                // If the current value is an object, recursively call the function
                paths.push('Processdata#' + modulname + '#ProcessData#' + instancename + '#' + currentPath);
                const nestedPaths = getObjectPaths(value, currentPath, modulname, instancename);
                paths.push(...nestedPaths);
            }
        }
    }

    // Find the maximum path length
    const maxLength = Math.max(...paths.map(path => path.split('.').length));

    // Filter out paths with shorter lengths
    const filteredPaths = paths.filter(path => path.split('.').length === maxLength);



    return filteredPaths;
}

function findObjectsWithProperty(obj, propName, path = []) {
    let results = [];

    for (let key in obj) {
        if (obj.hasOwnProperty(key)) {
            let currentPath = path.concat(key);
            let value = obj[key];

            if (typeof value === 'object') {
                // Recursively search nested objects
                results = results.concat(findObjectsWithProperty(value, propName, currentPath));
            } else if (key === propName) {
                // If the property name matches, store the path of the current object
                results.push({
                    name: currentPath[currentPath.length - 2],
                    path: currentPath.slice(0, -1).join('.'),
                    type: obj.type
                });
            }
        }
    }

    return results;
}
