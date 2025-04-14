const { defineConfig } = require('eslint/config');
const globals = require('globals');


module.exports = defineConfig([
  { files: ['**/*.js'], languageOptions: { sourceType: 'module' } },
  { files: ['**/*.{js,mjs,cjs}'], languageOptions: { globals: globals.browser } },
]);