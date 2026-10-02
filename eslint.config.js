import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // frontend/ é um projeto antigo separado, com eslint/tsconfig próprios.
  globalIgnores(['dist', 'frontend', '.claude']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
    // Dívida antiga (186 achados em 2026-10-02): como aviso, não erro, pra
    // checagem do PR não travar em código que já existia. Corrigir aos
    // poucos e voltar pra erro — ver docs/ROADMAP.md (P4).
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      // `cond ? a() : b()` como comando é usado no código todo.
      '@typescript-eslint/no-unused-expressions': ['error', { allowTernary: true }],
    },
  },
  {
    // Edge functions rodam no Deno e alimentam clientes reais — achados
    // antigos ficam como aviso pra não forçar mexer nelas (deploy arriscado).
    files: ['supabase/functions/**/*.ts'],
    languageOptions: {
      globals: { Deno: 'readonly' },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      'prefer-const': 'warn',
      'no-useless-assignment': 'warn',
      'preserve-caught-error': 'warn',
      'no-misleading-character-class': 'warn',
    },
  },
])
