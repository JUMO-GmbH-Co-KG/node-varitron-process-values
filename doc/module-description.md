# read process values

The read function lets you read process values for a given selector

## input

Selector (String)
List of Selectors (String[])

## output

Result as an object with the following properties: 
    - selector
    - value
    - type (type of the process value)
    - readOnly (boolean)
    - unit (measuring unit of the process value)
    -error - code (errorcode of the process value)
    -error - text (errortext of the process value)

# write process values

The write function lets you write process values to a given selector

## input

Key value pair (selector (String), value)
List of key value pairs ([] of key value pairs)

## output

Error if failing to write process values


# browse process values

## input

no input parameter

## output

A list of process values as a tree 
----
# Node-RED module


