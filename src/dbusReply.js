/**
 * Formats and processes data received from D-Bus responses.
 *
 * @param {any} data - The raw data received from D-Bus responses.
 * @returns {Array|Object} - The formatted data, ensuring a consistent JSON structure.
 * @description
 * This function handles various scenarios for processing D-Bus response data:
 * - If the data is undefined, null, or an empty array, it returns an empty array.
 * - If the data is a string and represents a JSON object or array, it parses and returns the corresponding JavaScript object.
 * - If the data is an object or array, it is returned as is.
 * - For any other data type, it is wrapped in an array to ensure a valid JSON object is returned.
 *
 * @throws {SyntaxError} - Throws an error if parsing a string fails due to invalid JSON syntax.
 *
 * @example
 * // Example usage:
 * const formattedData = formatData(dbusResponseData);
 */
export function formatData(data) {
    // Handle cases where data is undefined, null, or an empty array.
    if (data === undefined || data === null || data.length === 0) {
        return [];
    }

    // Handle cases where data is a string representing a JSON object or array.
    if (typeof data === 'string') {
        // return a string as a parsed object or array if it starts with { or [
        if (data.match(/^\s*(\{.*\}|\[.*\])\s*$/gs)) {
            try {
                const parsedData = JSON.parse(data);
                return parsedData;
            } catch (error) {
                throw new SyntaxError('function formatData: Invalid JSON string');
            }
        }
    }
    // Handle cases where data is an object or array.
    if (typeof data === 'object') {
        return data;
    }
    // For any other data type, wrap it in an array to ensure a valid JSON object.
    return [data];
}



/**
 * Parses a D-Bus inner item and extracts its type and value.
 *
 * @param {*} item - The inner item to parse.
 * @returns {Object|null} - An object containing the type and value, or null if the item is invalid.
 */
const parseInnerItem = (item) => {
    // an item contains an array of two items:
    // 0: the dbus description of the value, witch is an array with one obejct as element containing the type and the child
    // 1: an array with the actual value
    if (Array.isArray(item) && item.length === 2) {
        const dbusDescription = item[0];
        const value = item[1];

        if (Array.isArray(dbusDescription) && dbusDescription.length === 1 && typeof dbusDescription[0] === 'object' && Array.isArray(value)) {
            const type = dbusDescription[0].type; // the type of the value, e.g. 's' for string, 'b' for boolean, etc.
            if (type === 's') {
                // string
                return { type: 'string', value: value[0] };
            } else if (type === 'b') {
                // boolean
                return { type: 'boolean', value: value[0] };
            } else if (type === 'i') {
                // integer
                return { type: 'integer', value: value[0] };
            } else if (type === 'a') {
                // array
                return { type: 'array', value: value[0] };
            }
        }
    }
    return null; // invalid item format
};


/**
 * Parses the result of a Jupiter D-Bus response and handles error conditions.
 *
 * @param {Array} result - The raw result array received from a Jupiter D-Bus response.
 *   result = [ errCode, errText, <data> ]
 * @returns {Array|Object|undefined} - The parsed and formatted data, or undefined if the result is not as expected.
 * @throws {Error} - Throws an error if the Jupiter D-Bus response indicates an error (errCode !== 0).
 *
 * @description
 * This function is designed to handle Jupiter D-Bus response arrays with the following structure:
 * result = [ errCode, errText, <data> ]
 * If errCode is not 0, indicating an error, an error message is thrown.
 * If the response is as expected, the data is extracted and formatted using the formatData function.
 *
 * @example
 * // Example usage:
 * try {
 *     const parsedResult = parse(jupiterDbusResponse);
 *     // Process the parsed result...
 * } catch (error) {
 *     // Handle the error...
 * }
 */
export function parse(message) {
    if (Array.isArray(message) && message.length > 1) {
        // message[0]   unwichtiger Muell
        const result = message[1];
        // the result is an array of one item which contain an array of Three items, those items are:
        // 0: error code (0 for success)
        // 1: error message (empty for success)
        // 2: the actual result
        if (Array.isArray(result) && result.length > 0) {
            if (Array.isArray(result[0]) && result[0].length === 3) {
                const errorCode = parseInnerItem(result[0][0]);
                const errorMessage = parseInnerItem(result[0][1]);
                const actualResult = parseInnerItem(result[0][2]);
                // If the error code is not 0, indicating an error, throw an error with the error code and text.
                if (errorCode.value !== 0) {
                    console.log(`Error code: ${errorCode.value}`);
                    throw new Error(`${errorCode.value}: ${errorMessage.value}`);
                }
                // If the response is as expected, extract and format the data using the formatData function.
                return formatData(actualResult.value);
            }
        }
    }
    // Return undefined if the result is not as expected.
    return undefined;
}
