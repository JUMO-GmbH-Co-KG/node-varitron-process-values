import { getProviderList } from './browseProcessValues.js'

const providerlist = await getProviderList();
console.log(providerlist);
console.log(providerlist[3].value.BatteryState.value.SystemBattery.value);