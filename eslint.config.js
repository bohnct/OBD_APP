import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'coverage'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked],
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: { project: './tsconfig.app.json', tsconfigRootDir: import.meta.dirname },
    },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { ignoreRestSiblings: true, varsIgnorePattern: '^_', argsIgnorePattern: '^_' },
      ],
      // Only the safety gate may talk to the adapter. Everything else imports the gated link.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/elm/elmClient', '**/transport/*'],
              message: 'Talk to the vehicle through src/link (the safety gate), never directly.',
            },
          ],
        },
      ],
    },
  },
  {
    // The modules that legitimately sit below the gate.
    files: ['src/link/**', 'src/safety/**', 'src/elm/**', 'src/transport/**', 'src/**/*.test.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
);
