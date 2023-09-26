import { getProviderList, getObjectPaths } from './browseProcessValues.js'

const providerlist = await getProviderList();
console.log(providerlist);
let urlList = [];
for (let i = 0; i < providerlist.length; i++) {
    const paths = getObjectPaths(providerlist[i].value, undefined, providerlist[i].modulName, providerlist[i].instanceName);
    urlList.push(paths);
}
console.log(urlList);