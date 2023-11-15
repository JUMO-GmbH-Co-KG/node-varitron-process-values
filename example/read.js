import { read } from '../src/readProcessValues.js';

// single buffer read
const processValue1 = await read(['ProcessData#DataBaseManagement#ProcessData#DatabaseManagement#MemoryAlarm',
    'ProcessData#SystemObserver#ProcessData#SystemObserver#Memory/Root/Available']);
console.log('processValue1: ' + JSON.stringify(processValue1));

// double buffer read
const processValue2 = await read('ProcessData#SystemObserver#ProcessData#SystemObserver#Memory/Root/Available');
console.log('processValue2: ' + JSON.stringify(processValue2));

const processValue3 = await read('ProcessData#RealTimeScheduler#ProcessData#RealTimeThread01/ThreadData#AverageValue');
console.log('processValue3: ' + JSON.stringify(processValue3));


// read boolean
const processValue4 = await read('ProcessData#SpsConfigurationManager#ConfigurationProcessData#SharedMemory#BinaryValues001');
console.log('processValue4: ' + JSON.stringify(processValue4));

// read and write bit (ethercatgateway)
const binaryoutput = await read('ProcessData#EtherCatGateway#ProcessData#BinaryModuleOutput#DIO12_6/BinaryOutputs/DO001');
console.log('binaryoutput: ' + JSON.stringify(binaryoutput));

