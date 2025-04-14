const js = require('@eslint/js');
const nodePlugin = require('eslint-plugin-node');

module.exports = [
  js.configs.recommended,
  {
    plugins: {
      node: nodePlugin,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        process: true,
        console: true,
      },
    },
    rules: {
      semi: ['error', 'always'],
      quotes: ['error', 'single'],
    },
    ignores: [
      'node_modules/',
      'scripts/',
      'coverage/',
      './src/test/',
      'eslint.config.cjs',
    ],
  },
  {
    files: ['**/*.test.js', '**/__tests__/**/*.js'],
    languageOptions: {
      globals: {
        jest: true,
        describe: true,
        it: true,
        expect: true,
        beforeAll: true,
        afterAll: true,
        afterEach: true,
        beforeEach: true,
      },
    },
  },
];
