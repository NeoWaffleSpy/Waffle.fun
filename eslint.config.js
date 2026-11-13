import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'node_modules'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked, prettier],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // Uniform maps on ShaderMaterial are Record<string, IUniform>; `!` is the honest assertion.
      '@typescript-eslint/no-non-null-assertion': 'off',
      // Projects must never import a backend SDK directly: go through src/services.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@supabase/*', 'firebase', 'firebase/*'],
              message: 'Import backend features from src/services instead.',
            },
          ],
        },
      ],
    },
  },
  {
    // The hub must stay light: forbid three.js in hub-level code.
    files: [
      'src/Hub.tsx',
      'src/App.tsx',
      'src/main.tsx',
      'src/shared/components/**',
      'src/projects/registry.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['three', 'three/*', '@react-three/*', '**/shared/three/*'],
              message: 'Hub code must not import three.js; it belongs in 3D project chunks.',
            },
          ],
        },
      ],
    },
  },
  {
    // Deterministic code (replays + future server-side verification) must give
    // bit-identical results on every engine: only IEEE-exact operations.
    files: ['src/shared/worlds/**/*.ts', 'src/projects/*/sim/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        ...[
          'sin',
          'cos',
          'tan',
          'asin',
          'acos',
          'atan',
          'atan2',
          'pow',
          'exp',
          'log',
          'hypot',
          'cbrt',
        ].map((property) => ({
          object: 'Math',
          property,
          message: 'Not bit-identical across JS engines. Use dsin/dcos from shared/worlds/dmath.',
        })),
        { object: 'Math', property: 'random', message: 'Use a seeded PRNG (mulberry32).' },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'Simulations must not depend on wall-clock time.' },
        { name: 'performance', message: 'Simulations must not depend on wall-clock time.' },
      ],
    },
  },
  {
    files: ['*.config.{js,ts}', 'scripts/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.{js,mjs}'],
    extends: [js.configs.recommended, prettier],
    languageOptions: { globals: globals.node },
  },
);
