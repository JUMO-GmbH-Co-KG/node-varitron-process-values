export function getProcessDataDescriptionBuffer(moduleName, instanceName, objectName, buffer) {
    const foundObject = buffer.find(obj =>
        obj.moduleName === moduleName &&
        obj.instanceName === instanceName &&
        obj.objectName === objectName
    );
    if (foundObject) {
        return foundObject.processDescription;
    } else {
        return undefined;
    }
}