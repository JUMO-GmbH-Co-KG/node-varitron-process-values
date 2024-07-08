import { getList } from '../src/browseProcessValues.js';
import { existsSync, writeFileSync, readFileSync } from 'fs';

// get provider list
let providerlist;
try {
    providerlist = await getList();
} catch (e) {
    console.log('Error: ' + e);
    process.exit(1);
}

// write provider list to file if file does not exist
const providerListTestFileName = 'providerlist.json';
if (!existsSync(providerListTestFileName)) {
    writeFileSync(providerListTestFileName, JSON.stringify(providerlist));
    console.log('Written provider list to file: ' + providerListTestFileName);
    process.exit(0);
}

// read provider list from file
const providerlistFromFile = readFileSync('providerlist.json', 'utf8');

// compare provider list with expected result
const equal = JSON.stringify(providerlist) === providerlistFromFile;

// print result
console.log(equal ? 'OK' : '\x1b[31mERROR\x1b[0m');
