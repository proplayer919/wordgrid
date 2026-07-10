import tsParser from '@typescript-eslint/parser';
import tsPlugin from 'typescript-eslint';

export default [
  {
    ignores: ['node_modules/', 'dist/', 'build/'],
  },

  {
    files: ['src/**/*.{js,jsx,ts,tsx}', 'server/**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      'quotes': ['error', 'single'],
      'semi': ['error', 'always'],
      ...tsPlugin.configs.recommended.rules,
    },
  },
];
