import { createRequire } from 'module';
const require = createRequire(import.meta.url);

//const native = require('../build/Release/shared_memory');
const native = require('../build/Release/shared_memory');
export { native as shared_memory };