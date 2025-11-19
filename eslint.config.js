import js from '@eslint/js';
import security from 'eslint-plugin-security';
import globals from 'globals';

export default [
    js.configs.recommended,
    security.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.node,
                ...globals.mocha,
            }
        },
        rules: {
            'indent': [
                'error',
                4,
                {
                    'SwitchCase': 1
                }
            ],
            'linebreak-style': ['error', 'unix'],
            'quotes': ['error', 'single'],
            'semi': ['error', 'always'],
            'object-curly-spacing': ['error', 'always'],
            'prefer-const': 'error',
            'no-var': 'error',
            'object-shorthand': 'error',
            'space-before-function-paren': [
                'error',
                {
                    'anonymous': 'always',
                    'named': 'never',
                    'asyncArrow': 'always'
                }
            ],
            'padded-blocks': [
                'error',
                {
                    'blocks': 'never'
                }
            ],
            'complexity': [
                'error',
                {
                    'max': 10
                }
            ],
            'max-statements': [
                'error',
                15,
                {
                    'ignoreTopLevelFunctions': false
                }
            ],
            'no-multiple-empty-lines': 'error',
            'block-scoped-var': 'error',
            'default-case': 'error',
            'guard-for-in': 'error',
            'no-extra-bind': 'error',
            'no-implicit-coercion': 'error',
            'security/detect-object-injection': 'off'
        }
    }
];
