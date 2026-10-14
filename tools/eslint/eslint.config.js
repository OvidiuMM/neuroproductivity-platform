// Configuración de ESLint. Vive en tools/eslint con su propio TypeScript 5.9 porque typescript-eslint
// aún no admite el TypeScript 7 del proyecto; se ejecuta desde la raíz con `npm run lint`.
import { fixupPluginRules } from '@eslint/compat';
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import playwright from 'eslint-plugin-playwright';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import { fileURLToPath } from 'node:url';
import tseslint from 'typescript-eslint';

// Ruta del sistema de archivos (con espacios o en Windows, `URL.pathname` no lo es)
const root = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig(
  {
    ignores: [
      '**/node_modules/**',
      'dist/**',
      'functions/lib/**',
      'test-results/**',
      'playwright-report/**',
      'public/**',
      'tools/eslint/**'
    ]
  },

  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      // Cada archivo usa el tsconfig más cercano: el de la raíz, functions/ o functions/test/
      parserOptions: { projectService: true, tsconfigRootDir: root }
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      // Variables sin usar: error, salvo las que empiezan por _ (parámetros obligados por una firma)
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
      ],
      // En React, un manejador async en onClick/onSubmit es lo normal; los manejadores capturan sus errores
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
      // test() y describe() de node:test devuelven una promesa que el propio ejecutor espera
      '@typescript-eslint/no-floating-promises': [
        'error',
        {
          allowForKnownSafeCalls: [{ from: 'package', package: 'node:test', name: ['test', 'it', 'describe', 'suite'] }]
        }
      ]
    }
  },

  // App (navegador)
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: jsxA11y.flatConfigs.recommended.languageOptions.parserOptions
    },
    plugins: {
      // jsx-a11y aún usa la API de reglas anterior a ESLint 10
      'jsx-a11y': fixupPluginRules(jsxA11y),
      'react-refresh': reactRefresh
    },
    extends: [reactHooks.configs.flat.recommended],
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      // Las etiquetas que envuelven la casilla tienen el texto un nivel más abajo (label > div > span)
      'jsx-a11y/label-has-associated-control': ['error', { depth: 3 }],
      'react-refresh/only-export-components': ['error', { allowConstantExport: true }]
    }
  },

  // Cloud Functions, configuración y pruebas que corren en Node
  {
    files: ['functions/**/*.ts', 'tests/**/*.ts', '*.config.ts'],
    languageOptions: { globals: globals.node }
  },

  // Pruebas de extremo a extremo
  {
    files: ['tests/e2e/**/*.ts'],
    extends: [playwright.configs['flat/recommended']],
    rules: {
      // Ayudantes de helpers.ts que hacen las comprobaciones
      'playwright/expect-expect': [
        'error',
        { assertFunctionNames: ['expectNoViolations', 'expectNoHorizontalOverflow', 'expectNoInnerOverflow'] }
      ]
    }
  },

  // Desactiva las reglas de estilo que se pisan con Prettier (siempre la última)
  prettier
);
