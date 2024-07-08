# JUMO variTRON process values

The JUMO variTRON process value module allows you to read and write process values on the JUMO variTRON system. It provides functions for retrieving a list of available process values, reading values from specific selectors, writing values to specific selectors, and setting the PlcActive flags.

## `read(input)`

The `read(input)` function is an asynchronous function that reads data from a given selector. The input can be either a single string or an array of strings.

### Parameters

- `input` (Array|String): The input to read from. It can be a single string or an array of strings. Each string should be an selector of the JUMO variTRON system.

### Returns

- A Promise that resolves with the read data. If the input was a single string, the Promise resolves with a single object. If the input was an array, the Promise resolves with an array of results.
- The result is an object with the following properties:
     - selector
     - value
     - type: type of the process value
     - readOnly: true if the process value is read only
     - unit: measuring unit of the process value
     - error: code and text of the process value error (for example overrange, underrange, etc.)

### Errors

- If the function encounters an error while reading from an item, it rejects the Promise with an Error object. The error message includes the stringified item and the original error message.

### Example

```javascript
read(['selector1', 'selector2'])
    .then(results => console.log(results))
    .catch(error => console.error(error));
```

In this example, `read` is called with an array of selectors as string. The function reads from each selector and logs the results. If an error occurs while reading from a URL, the function logs the error.

## `write(input)`

The `write(input)` function is an asynchronous function that writes data to a given selector. The input can be either a single object or an array of objects. Each object should have a `selector` property and a `value` property.

### Parameters

- `input` (Array|Object): The input to write to. It can be a single object or an array of objects. Each object should have a `selector` property (string) and a `value` property (string, number, or boolean).

### Returns

- A Promise that resolves with the write operation's result. If the input was a single object, the Promise resolves with a single object. If the input was an array, the Promise resolves with an array of results. Each result object has a `done` property that indicates whether the write operation was successful.

### Errors

- If the function encounters an error while writing to an item, it rejects the Promise with an Error object. The error message includes the stringified item and the original error message.

### Example

```javascript
write([{selector: 'selector1', value: 'newValue1'}, {selector: 'selector2', value: 'newValue2'}])
    .then(results => console.log(results))
    .catch(error => console.error(error));
```

In this example, `write` is called with an array of objects. Each object has a `selector` property that specifies the selector to write to and a `value` property that specifies the new value. The function writes the new value to each selector and logs the results. If an error occurs while writing to a URL, the function logs the error.

## `getList()`

The `getList()` function is a asynchronous function that retrieves a list of all available process values of each module of the JUMO variTRON system.

### Parameters

- None

### Returns

- An array of objects, each representing a module. Each object contains either a flat list or a tree of process values. Each process value has the following properties:
  - `name`: A string that identifies the process value.
  - `selector`: A string that uniquely identifies the process value.
  - `type`: The type of the process value.
  - `readOnly`: A boolean indicating whether the process value is read-only.
  - `unit`: The unit of the process value if available.

### Errors

- If the function encounters an error while retrieving the process values, it throws an Error.

### Example

```javascript
const processValues = getList()
    .then(results => console.log(results))
    .catch(error => console.error(error));
```

In this example, `getList` is called. The function retrieves a list of all available process values and logs them. If an error occurs while retrieving the process values, the function logs the error.

## `setPlcActiveFlags()`

The `setPlcActiveFlags()` function is an asynchronous function that sets the PlcActive flags by retrieving all existing PlcActive selectors, creating a list of selector-value pairs, and writing them to true. This is necessary to enable controller modules, placed on the JUMO variTRON system via EtherCAT. The function should be called only once after the system is started.

### Parameters

- None

### Returns

- A Promise that resolves when the flags are set.

### Errors

- If the function encounters an error while setting the flags, it rejects the Promise with an Error object.

### Example

```javascript
setPlcActiveFlags()
    .then(() => console.log('PlcActive flags set successfully'))
    .catch(error => console.error(error));
```

In this example, `setPlcActiveFlags` is called. The function sets the PlcActive flags and logs a success message. If an error occurs while setting the flags, the function logs the error.
