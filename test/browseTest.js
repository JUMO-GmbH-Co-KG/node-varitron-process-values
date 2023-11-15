import { getProviderList } from '../src/browseProcessValues.js';
import { assert } from 'chai';

describe('Browsing', () => {
    describe('browseProcessValues.js', () => {
        it('getProviderList is of type function', () => {
            assert.isFunction(getProviderList);
        });
        it('returns an answer', () => {
            assert.isFunction(getProviderList);
        });
    });
});