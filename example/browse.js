import { getList } from '../src/browseProcessValues.js';

// get provider list
const providerlist = await getList();
console.log(providerlist);
