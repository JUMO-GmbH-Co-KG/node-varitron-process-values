import { getProviderList, } from './browseProcessValues.js'
import { read } from './readProcessValues.js'
import { write } from "./writeProcessValues.js"

//test get providerlist
const providerlist = await getProviderList();
console.log(providerlist);

// //single buffer read
// const processValue1 = await read(['ProcessData#DataBaseManagement#ProcessData#DatabaseManagement#MemoryAlarm',
//     'ProcessData#SystemObserver#ProcessData#SystemObserver#Memory/Root/Available']);
// console.log('processValue1: ' + JSON.stringify(processValue1));

// //double buffer read
// const processValue2 = await read('ProcessData#SystemObserver#ProcessData#SystemObserver#Memory/Root/Available');
// console.log('processValue2: ' + JSON.stringify(processValue2));

// const processValue3 = await read('ProcessData#RealTimeScheduler#ProcessData#RealTimeThread01/ThreadData#AverageValue');
// console.log('processValue3: ' + JSON.stringify(processValue3));


// //read boolean
// const processValue4 = await read('ProcessData#SpsConfigurationManager#ConfigurationProcessData#SharedMemory#BinaryValues001');
// console.log('processValue4: ' + JSON.stringify(processValue4));

//read and write bit (ethercatgateway)
// const binaryoutput = await read('ProcessData#EtherCatGateway#ProcessData#BinaryModuleOutput#DIO12_6/BinaryOutputs/DO001');
// console.log('binaryoutput: ' + JSON.stringify(binaryoutput));

// await write({
//     "processValueUrl": 'ProcessData#EtherCatGateway#ProcessData#BinaryModuleOutput#DIO12_6/BinaryOutputs/DO001',
//     "processValue": true
// });
// const binaryoutputwritten = await read('ProcessData#EtherCatGateway#ProcessData#BinaryModuleOutput#DIO12_6/BinaryOutputs/DO001');
// console.log('binaryoutputwritten: ' + JSON.stringify(binaryoutputwritten));

// await write({
//     "processValueUrl": 'ProcessData#EtherCatGateway#ProcessData#BinaryModuleOutput#DIO12_6/BinaryOutputs/DO001',
//     "processValue": false
// });
// const binaryoutputwritten2 = await read('ProcessData#EtherCatGateway#ProcessData#BinaryModuleOutput#DIO12_6/BinaryOutputs/DO001');
// console.log('binaryoutputwritten2: ' + JSON.stringify(binaryoutputwritten2));



//read and write UnsignedInteger (ethercatgateway)
// const unsignedInt = await read('ProcessData#EtherCatGateway#ProcessData#AnalogModuleOutput#CTR04_5/CommonOutputs/OutputLevelOnOff');
// console.log('unsignedInt: ' + JSON.stringify(unsignedInt));

// await write({
//     "processValueUrl": 'ProcessData#EtherCatGateway#ProcessData#AnalogModuleOutput#CTR04_5/CommonOutputs/OutputLevelOnOff',
//     "processValue": 123
// });
// const unsignedIntwritten = await read('ProcessData#EtherCatGateway#ProcessData#AnalogModuleOutput#CTR04_5/CommonOutputs/OutputLevelOnOff');
// console.log('unsignedIntwritten(123): ' + JSON.stringify(unsignedIntwritten));

// await write({
//     "processValueUrl": 'ProcessData#EtherCatGateway#ProcessData#AnalogModuleOutput#CTR04_5/CommonOutputs/OutputLevelOnOff',
//     "processValue": 456
// });

// const unsignedIntwritten2 = await read('ProcessData#EtherCatGateway#ProcessData#AnalogModuleOutput#CTR04_5/CommonOutputs/OutputLevelOnOff');
// console.log('unsignedIntwritten(456): ' + JSON.stringify(unsignedIntwritten2));


//read and write Float (ethercatgateway) @todo: another example
// const float = await read('ProcessData#EtherCatGateway#ProcessData#AnalogModuleInput#CTR04_5/ActualValues/ActualValue001');
// console.log('Float: ' + JSON.stringify(float));

// await write({
//     "processValueUrl": 'ProcessData#EtherCatGateway#ProcessData#AnalogModuleInput#CTR04_5/ActualValues/ActualValue001',
//     "processValue": 123.456
// });
// const floatwritten = await read('ProcessData#EtherCatGateway#ProcessData#AnalogModuleInput#CTR04_5/ActualValues/ActualValue001');
// console.log('floatwritten(123.456): ' + JSON.stringify(floatwritten));

// await write({
//     "processValueUrl": 'ProcessData#EtherCatGateway#ProcessData#AnalogModuleInput#CTR04_5/ActualValues/ActualValue001',
//     "processValue": 456.123
// });

// const floatwritten2 = await read('ProcessData#EtherCatGateway#ProcessData#AnalogModuleInput#CTR04_5/ActualValues/ActualValue001');
// console.log('floatwritten2(456.123): ' + JSON.stringify(floatwritten2));

// console.log('ethercatvalue: ' + JSON.stringify(ethercatvalue));
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
