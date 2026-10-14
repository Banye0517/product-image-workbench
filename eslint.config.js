import react from 'eslint-plugin-react';
import globals from 'globals';
export default [
  { ignores: ['dist/**', 'release/**', 'node_modules/**', '.qa/**'] },
  { files: ['src/**/*.jsx', 'src/**/*.js', 'shared/**/*.js', 'server/**/*.js'], languageOptions: { ecmaVersion: 'latest', sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } }, globals: { ...globals.browser, ...globals.node } }, plugins: { react }, rules: { 'no-undef': 'error', 'react/jsx-no-undef': 'error' } }
];
