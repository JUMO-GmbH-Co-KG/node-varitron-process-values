/**
 * @file importShm.js
 * @description A JavaScript module that serves as a wrapper for the native shared-memory library.
 *
 * This module imports the 'shared-memory' native module, providing an interface to interact with shared memory in a Node.js environment.
 * The native module is loaded using the CommonJS 'require' syntax in conjunction with the 'createRequire' function from the 'module' module.
 * The imported 'native' object is then exported for use in other parts of the application.
 *
 * @requires {Function} createRequire - A function from the 'module' module that creates a 'require' function for the current module.
 * @requires {Object} native - The native shared-memory module, providing low-level shared memory functionality.
 *
 * @exports {Object} native - The native shared-memory module.
 */

import { createRequire } from 'module';

// Create a 'require' function for the current module.
const require = createRequire(import.meta.url);

// Import the native shared-memory module from the specified path.
const native = require('../build/Release/shared-memory');

// Export the native module for use in other parts of the application.
export { native };