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
            return JSON.parse(data);
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
 * Parses the result of a Jupiter D-Bus response and handles error conditions.
 *
 * @param {Object} result - The raw result object received from a Jupiter D-Bus response.
 * @returns {Array|Object|undefined} - The parsed and formatted data, or undefined if the result is not as expected.
 * @throws {Error} - Throws an error if the Jupiter D-Bus response indicates an error (errCode !== 0).
 *
 * @description
 * This function is designed to handle Jupiter D-Bus response objects with the following structure:
 * result.value = [ errCode, errText, <data> ]
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
export function parse(result) {
    // Check if the result and result.value exist.
    if (result && result.value) {
        // Extract the error code from the Jupiter D-Bus response. result.value = [ errCode, errText, <data> ].
        const errorCode = result.value[0].value;

        // If the error code is not 0, indicating an error, throw an error with the error code and text.
        if (errorCode !== 0) {
            const errorText = result.value[1].value;
            throw new Error(`${errorCode}: ${errorText}`);
        }
        // If the response is as expected, extract and format the data using the formatData function.
        return formatData(result.value[2].value);
    }
    // Return undefined if the result is not as expected.
    return undefined;
}
