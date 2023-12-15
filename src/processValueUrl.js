// function to objectify process value url
export function getObjectFromUrl(processValueUrl) {
    const parts = processValueUrl.split('#');

    if (parts.length !== 5) {
        throw new Error(`Invalid process value url: ${processValueUrl}`);
    }

    const moduleName = parts[1];
    const objectName = parts[2];
    const instanceName = parts[3];
    let parameterUrl = parts[4];

    // replace all / with .value. to be able to use this url in the process description tree
    parameterUrl = parameterUrl.replace(/\//g, '.value.');
    parameterUrl = 'value.' + parameterUrl;

    const obj = {
        moduleName,
        objectName,
        instanceName,
        parameterUrl
    };

    return obj;
}

// function to search for a parameterUrl in the process description tree
export function getNestedProcessValueDescription(processDescription, parameterUrl) {
    // if we use array indices in the path, we need to replace them with '.$index'
    // parameterUrl = parameterUrl.replace(/\[(\w+)\]/g, '.$1');

    const urlPartList = parameterUrl.split('.');

    // build the path to the pamameter inside the process description tree
    for (const urlPart of urlPartList) {
        if (urlPart in processDescription) {
            processDescription = processDescription[urlPart];
        } else {
            throw new Error(`Parameter ${parameterUrl} not found in process description`);
        }
    }
    return processDescription;
}
