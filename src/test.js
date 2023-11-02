import { getProviderList, } from './browseProcessValues.js'
import { read } from './readProcessValues.js'
import { write } from "./writeProcessValues.js"
const providerlist = await getProviderList();
//console.log(providerlist);
const ethercatvalue = await read('ProcessData#EtherCatGateway#ProcessData#BinaryModuleInput#DIO12_6/BinaryInputs/BinaryInput010');
const binaryoutput = await read('ProcessData#EtherCatGateway#ProcessData#BinaryModuleOutput#DIO12_6/BinaryOutputs/DO001');
console.log('binaryoutput: ' + JSON.stringify(binaryoutput));
// //single buffer read
// const processValue1 = await read(['ProcessData#DataBaseManagement#ProcessData#DatabaseManagement#MemoryAlarm',
//     'ProcessData#SystemObserver#ProcessData#SystemObserver#Memory/Root/Available']);
// //double buffer read
// const processValue2 = await read('ProcessData#SystemObserver#ProcessData#SystemObserver#Memory/Root/Available');
// const processValue3 = await read('ProcessData#RealTimeScheduler#ProcessData#RealTimeThread01/ThreadData#AverageValue');
// //read boolean
// const processValue4 = await read('ProcessData#SpsConfigurationManager#ConfigurationProcessData#SharedMemory#BinaryValues001');

// console.log(providerlist);
// console.log('ethercatvalue: ' + JSON.stringify(ethercatvalue));
// console.log('processValue1: ' + JSON.stringify(processValue1));
// console.log('processValue2: ' + JSON.stringify(processValue2));
// console.log('processValue3: ' + JSON.stringify(processValue3));
// console.log('processValue4: ' + JSON.stringify(processValue4));
// console.log('binaryoutput: ' + JSON.stringify(binaryoutput));

// //write single buffer
// await write({
//     "processValueUrl": 'ProcessData#DataBaseManagement#ProcessData#DatabaseManagement#MemoryAlarm',
//     "processValue": true
// });
// //write read only
// try {
//     await write({
//         "processValueUrl": 'ProcessData#SystemObserver#ProcessData#SystemObserver#Memory/Root/Available',
//         "processValue": 980000.34
//     });
// } catch (e) {
//     console.error('Error: Unable to write process value.' + e);

// }
// //write double buffer
// try {
//     await write({
//         "processValueUrl": 'ProcessData#RealTimeScheduler#ProcessData#RealTimeThread01/ThreadData#AverageValue',
//         "processValue": 15.5
//     });
// } catch (e) {
//     console.error('Error: Unable to write double buffer process value.' + e);
// }

// const writtenProcessValue = await read('ProcessData#DataBaseManagement#ProcessData#DatabaseManagement#MemoryAlarm');
// const writtenProcessValue3 = await read('ProcessData#RealTimeScheduler#ProcessData#RealTimeThread01/ThreadData#AverageValue');
// console.log(writtenProcessValue);
// console.log(writtenProcessValue3);
await write({
    "processValueUrl": 'ProcessData#EtherCatGateway#ProcessData#BinaryModuleOutput#DIO12_6/BinaryOutputs/DO001',
    "processValue": true
});
const binaryoutputwritten = await read('ProcessData#EtherCatGateway#ProcessData#BinaryModuleOutput#DIO12_6/BinaryOutputs/DO001');
console.log('binaryoutputwritten: ' + JSON.stringify(binaryoutputwritten));

await write({
    "processValueUrl": 'ProcessData#EtherCatGateway#ProcessData#BinaryModuleOutput#DIO12_6/BinaryOutputs/DO001',
    "processValue": false
});
const binaryoutputwritten2 = await read('ProcessData#EtherCatGateway#ProcessData#BinaryModuleOutput#DIO12_6/BinaryOutputs/DO001');
console.log('binaryoutputwritten: ' + JSON.stringify(binaryoutputwritten2));
