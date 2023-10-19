import { getProviderList, } from './browseProcessValues.js'
import { read } from './readProcessValues.js'
import { write } from "./writeProcessValues.js"
const providerlist = await getProviderList();
//console.log(providerlist);
const ethercatvalue = await read('ProcessData#EtherCatGateway#ProcessData#BinaryModuleInput#DIO12_6/BinaryInputs/BinaryInput010');
//single buffer read
const processValue1 = await read('ProcessData#DataBaseManagement#ProcessData#DatabaseManagement#MemoryAlarm');
//double buffer read
const processValue2 = await read('ProcessData#SystemObserver#ProcessData#SystemObserver#Memory/Root/Available');
const processValue3 = await read('ProcessData#RealTimeScheduler#ProcessData#RealTimeThread01/ThreadData#AverageValue');

console.log(providerlist);
console.log('ethercatvalue: ' + JSON.stringify(ethercatvalue));
console.log('processValue1: ' + JSON.stringify(processValue1));
console.log('processValue2: ' + JSON.stringify(processValue2));
console.log('processValue3: ' + JSON.stringify(processValue3));
//write single buffer
await write('ProcessData#DataBaseManagement#ProcessData#DatabaseManagement#MemoryAlarm', true);
//write read only
try {
    await write('ProcessData#SystemObserver#ProcessData#SystemObserver#Memory/Root/Available', 980000.34);
} catch (e) {
    console.error('Error: Unable to write process value.' + e);

}
//write double buffer
try {
    await write('ProcessData#RealTimeScheduler#ProcessData#RealTimeThread01/ThreadData#AverageValue', 15.5);
} catch (e) {
    console.error('Error: Unable to write double buffer process value.' + e);
}

const writtenProcessValue = await read('ProcessData#DataBaseManagement#ProcessData#DatabaseManagement#MemoryAlarm');
const writtenProcessValue3 = await read('ProcessData#RealTimeScheduler#ProcessData#RealTimeThread01/ThreadData#AverageValue');
console.log(writtenProcessValue);
console.log(writtenProcessValue3);
