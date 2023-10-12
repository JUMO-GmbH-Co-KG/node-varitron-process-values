import { getProviderList, } from './browseProcessValues.js'
import { read } from './readProcessValues.js'

const providerlist = await getProviderList();
//console.log(providerlist);
const processValue = await read('ProcessData#SpsConfigurationManager#ConfigurationProcessData#SharedMemory#BinaryValues001#');
console.log(providerlist);
console.log(processValue);

