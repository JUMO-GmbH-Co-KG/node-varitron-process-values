import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const native = require('../build/Release/shared-memory');
export { native };