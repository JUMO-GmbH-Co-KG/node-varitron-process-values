export function getModuleName(processValueUrl) {
    const parts = processValueUrl.split('#');
    const substring = parts[1];
    return substring;
}

export function getInstanceName(processValueUrl) {
    const parts = processValueUrl.split('#');
    const substring = parts[3];
    return substring;
}

export function getObjectName(processValueUrl) {
    const parts = processValueUrl.split('#');
    const substring = parts[2];
    return substring;
}

//function to objectify process value url
export function getObjectFromUrl(processValueUrl) {
    const parts = processValueUrl.split('#');
    const moduleName = parts[1];
    const objectName = parts[2];
    const instanceName = parts[3];
    let parameterUrl = parts[4];

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
//function to return object from string
export function byString(o, s) {
    s = s.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
    s = s.replace(/^\./, '');           // strip a leading dot
    const a = s.split('.');
    for (let i = 0, n = a.length; i < n; ++i) {
        const k = a[i];
        if (k in o) {
            o = o[k];
        } else {
            return;
        }
    }
    return o;
}
