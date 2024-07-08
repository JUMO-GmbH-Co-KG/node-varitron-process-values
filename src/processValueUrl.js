/**
 * Parses a process value URL to extract relevant components and constructs an object representation.
 *
 * @param {string} processValueUrl - The URL containing information about the process value.
 * @returns {Object} - An object with properties representing the parsed components.
 * @throws {Error} - Throws an error if the input URL is invalid or does not contain the expected number of parts.
 */
export function getObjectFromUrl(processValueUrl) {
    // Split the process value URL into parts using '#' as the delimiter.
    const parts = processValueUrl.split('#');

    // Ensure the URL contains the expected number of parts.
    if (parts.length !== 5) {
        throw new Error(`Invalid process value url: ${processValueUrl}`);
    }

    // Extract components from the parts array.
    const moduleName = parts[1];
    const objectName = parts[2];
    const instanceName = parts[3];
    let parameterUrl = parts[4];

    // Replace all '/' with '.value.' to use the URL in the process description tree.
    parameterUrl = parameterUrl.replace(/\//g, '.value.');
    parameterUrl = 'value.' + parameterUrl;

    // Construct and return the object representation of the parsed components.
    const obj = {
        moduleName,
        objectName,
        instanceName,
        parameterUrl
    };

    return obj;
}

/**
 * Searches for a parameter URL in the process description tree and retrieves the corresponding process value description.
 *
 * @param {Object} processDescription - The process description tree to search within.
 * @param {string} parameterUrl - The URL representing the parameter's location in the process description tree.
 * @returns {Object} - The process value description found at the specified parameter URL.
 * @throws {Error} - Throws an error if the parameter URL is not found in the process description tree.
 */
export function getNestedProcessValueDescription(processDescription, parameterUrl) {
    // If array indices are used in the path, replace them with '.$index'.
    // parameterUrl = parameterUrl.replace(/\[(\w+)\]/g, '.$1');

    // Split the parameter URL into individual parts.
    const urlPartList = parameterUrl.split('.');

    // Build the path to the parameter inside the process description tree.
    for (const urlPart of urlPartList) {
        // Check if the current URL part exists in the process description.
        if (urlPart in processDescription) {
            processDescription = processDescription[urlPart];
        } else {
            // Throw an error if the parameter URL is not found in the process description.
            throw new Error(`Parameter ${parameterUrl} not found in process description`);
        }
    }
    // Return the process value description found at the specified parameter URL.
    return processDescription;
}
