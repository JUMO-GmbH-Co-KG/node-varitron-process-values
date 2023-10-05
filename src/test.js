import { getProviderList, } from './browseProcessValues.js'
import { read } from './readProcessValues.js'

const providerlist = await getProviderList();
//console.log(providerlist);
const processValue = await read('ProcessData#SystemObserver#ProcessData#SystemObserver#BatteryState/SystemBattery/CurrentValue#');
console.log(providerlist);
console.log(processValue);

