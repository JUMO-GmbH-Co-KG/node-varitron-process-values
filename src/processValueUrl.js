export function getModuleName(processValueUrl) {

    var parts = processValueUrl.split("#");
    var substring = parts[1];
    return substring;

}

export function getInstanceName(processValueUrl) {

    var parts = processValueUrl.split("#");
    var substring = parts[3];
    return substring;
}

export function getObjectName(processValueUrl) {
    var parts = processValueUrl.split("#");
    var substring = parts[2];
    return substring;
}

//function to objectify process value url
export function getObjectFromUrl(processValueUrl) {
    var parts = processValueUrl.split("#");
    var moduleName = parts[1];
    var objectName = parts[2];
    var instanceName = parts[3];
    var parameterUrl = parts[4];

    parameterUrl = parameterUrl.replace(/\//g, '.value.');
    parameterUrl = 'value.' + parameterUrl;

    const obj = {
        "moduleName": moduleName,
        "objectName": objectName,
        "instanceName": instanceName,
        "parameterUrl": parameterUrl
    }

    return obj;


}
//function to return object from string
export function byString(o, s) {
    s = s.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
    s = s.replace(/^\./, '');           // strip a leading dot
    var a = s.split('.');
    for (var i = 0, n = a.length; i < n; ++i) {
        var k = a[i];
        if (k in o) {
            o = o[k];
        } else {
            return;
        }
    }
    return o;
}
