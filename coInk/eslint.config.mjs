import typescriptEslintPlugin from '@typescript-eslint/eslint-plugin';
import typescriptEslintParser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettier from 'eslint-plugin-prettier';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import { resolve } from 'path';

export default [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'dist/**',
      '**/*.js',
    ],
  },
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      parser: typescriptEslintParser,
      parserOptions: {
        project: resolve('./tsconfig.json'), // 确保项目有 tsconfig.json
      },
    },
    plugins: {
      '@typescript-eslint': typescriptEslintPlugin,
      react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
      import: importPlugin,
      prettier,
    },
    rules: {
      ...typescriptEslintPlugin.configs.recommended.rules,
      ...prettier.configs.recommended.rules,
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
      'import/order': [
        'error',
        {
          groups: [['builtin', 'external'], 'internal', ['parent', 'sibling', 'index']],
          'newlines-between': 'always',
        },
      ],
      // 更多自定义规则...
      '@typescript-eslint/no-explicit-any': 'off',
    },
    settings: {
      react: { version: 'detect' },
    },
  },
];

