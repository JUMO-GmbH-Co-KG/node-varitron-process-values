import { getProviderList, } from './browseProcessValues.js'
import { read } from './readProcessValues.js'
import { write } from "./writeProcessValues.js"
const providerlist = await getProviderList();
//console.log(providerlist);
const processValue1 = await read('ProcessData#DataBaseManagement#ProcessData#DatabaseManagement#MemoryAlarm#');
const processValue2 = await read('ProcessData#SystemObserver#ProcessData#SystemObserver#Memory/Root/Available#');
console.log(providerlist);
console.log(processValue1);
console.log(processValue2);
write('ProcessData#DataBaseManagement#ProcessData#DatabaseManagement#MemoryAlarm#', true);
const writtenProcessValue = await read('ProcessData#DataBaseManagement#ProcessData#DatabaseManagement#MemoryAlarm#');
console.log(writtenProcessValue);
