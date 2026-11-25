const { createRequire } = require('node:module');
const path = require('node:path');
const requireBackend = createRequire(path.resolve(__dirname, '../../monolith-backend/package.json'));
const js = requireBackend('@eslint/js');
const parser = requireBackend('@typescript-eslint/parser');
const plugin = requireBackend('@typescript-eslint/eslint-plugin');
const globals = requireBackend('globals');

module.exports = [
  { ignores: ['**/dist/**'] },
  {
    files: ['**/*.ts'],
    languageOptions: { parser, sourceType: 'module', globals: globals.node },
    plugins: { '@typescript-eslint': plugin },
    rules: {
      ...js.configs.recommended.rules,
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-empty': 'error',
      eqeqeq: 'error',
    },
  },
  { files: ['**/*.cjs'], languageOptions: { sourceType: 'commonjs', globals: globals.node }, rules: js.configs.recommended.rules },
];