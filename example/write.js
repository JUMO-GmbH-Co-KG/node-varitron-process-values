import { read } from '../src/readProcessValues.js';
import { write } from '../src/writeProcessValues.js';

// read and write analog value
await write({
    'selector': 'ProcessData#EtherCatGateway#ProcessData#BinaryModuleOutput#DIO12_6/BinaryOutputs/DO001',
    'value': true
});
const binaryoutputwritten = await read('ProcessData#EtherCatGateway#ProcessData#BinaryModuleOutput#DIO12_6/BinaryOutputs/DO001');
console.log('binaryoutputwritten: ' + JSON.stringify(binaryoutputwritten));

await write({
    'selector': 'ProcessData#EtherCatGateway#ProcessData#BinaryModuleOutput#DIO12_6/BinaryOutputs/DO001',
    'value': false
});
const binaryoutputwritten2 = await read('ProcessData#EtherCatGateway#ProcessData#BinaryModuleOutput#DIO12_6/BinaryOutputs/DO001');
console.log('binaryoutputwritten2: ' + JSON.stringify(binaryoutputwritten2));

// read and write UnsignedInteger (ethercatgateway)
const unsignedInt = await read('ProcessData#EtherCatGateway#ProcessData#AnalogModuleOutput#CTR04_5/CommonOutputs/OutputLevelOnOff');
console.log('unsignedInt: ' + JSON.stringify(unsignedInt));

await write({
    'selector': 'ProcessData#EtherCatGateway#ProcessData#AnalogModuleOutput#CTR04_5/CommonOutputs/OutputLevelOnOff',
    'value': 123
});
const unsignedIntwritten = await read('ProcessData#EtherCatGateway#ProcessData#AnalogModuleOutput#CTR04_5/CommonOutputs/OutputLevelOnOff');
console.log('unsignedIntwritten(123): ' + JSON.stringify(unsignedIntwritten));

await write({
    'selector': 'ProcessData#EtherCatGateway#ProcessData#AnalogModuleOutput#CTR04_5/CommonOutputs/OutputLevelOnOff',
    'value': 456
});

const unsignedIntwritten2 = await read('ProcessData#EtherCatGateway#ProcessData#AnalogModuleOutput#CTR04_5/CommonOutputs/OutputLevelOnOff');
console.log('unsignedIntwritten(456): ' + JSON.stringify(unsignedIntwritten2));


// read and write Float (ethercatgateway) @todo: another example
const float = await read('ProcessData#EtherCatGateway#ProcessData#AnalogModuleInput#CTR04_5/ActualValues/ActualValue001');
console.log('Float: ' + JSON.stringify(float));

await write({
    'selector': 'ProcessData#EtherCatGateway#ProcessData#AnalogModuleInput#CTR04_5/ActualValues/ActualValue001',
    'value': 123.456
});
const floatwritten = await read('ProcessData#EtherCatGateway#ProcessData#AnalogModuleInput#CTR04_5/ActualValues/ActualValue001');
console.log('floatwritten(123.456): ' + JSON.stringify(floatwritten));

await write({
    'selector': 'ProcessData#EtherCatGateway#ProcessData#AnalogModuleInput#CTR04_5/ActualValues/ActualValue001',
    'value': 456.123
});

const floatwritten2 = await read('ProcessData#EtherCatGateway#ProcessData#AnalogModuleInput#CTR04_5/ActualValues/ActualValue001');
console.log('floatwritten2(456.123): ' + JSON.stringify(floatwritten2));

// write single buffer
await write({
    'selector': 'ProcessData#DataBaseManagement#ProcessData#DatabaseManagement#MemoryAlarm',
    'value': true
});

// write read only
try {
    await write({
        'selector': 'ProcessData#SystemObserver#ProcessData#SystemObserver#Memory/Root/Available',
        'value': 980000.34
    });
} catch (e) {
    console.error('Error: Unable to write process value: ' + e);
}

// write double buffer
try {
    await write({
        'selector': 'ProcessData#RealTimeScheduler#ProcessData#RealTimeThread01/ThreadData#AverageValue',
        'value': 15.5
    });
} catch (e) {
    console.error('Error: Unable to write double buffer process value: ' + e);
}

// write single buffer
await write({
    'selector': 'ProcessData#DataBaseManagement#ProcessData#DatabaseManagement#MemoryAlarm',
    'value': false,
});

const afterWriteFalse = await read('ProcessData#DataBaseManagement#ProcessData#DatabaseManagement#MemoryAlarm');

console.log(afterWriteFalse.value == false ? 'Write successful' : 'Write failed');

// write single buffer
await write({
    'selector': 'ProcessData#DataBaseManagement#ProcessData#DatabaseManagement#MemoryAlarm',
    'value': true,
});

const afterWriteTrue = await read('ProcessData#DataBaseManagement#ProcessData#DatabaseManagement#MemoryAlarm');

console.log(afterWriteTrue.value == true ? 'Write successful' : 'Write failed');
