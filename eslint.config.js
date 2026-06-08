import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    // Must come first so subsequent configs do not match generated files.
    ignores: [
      'node_modules/',
      '.svelte-kit/',
      'build/',
      'dist/',
      '.vercel/',
      'coverage/',
      'playwright-report/',
      'test-results/',
      'static/',
      'src/lib/types/db.generated.ts',
      // Deno-runtime edge functions — separate lint/build pipeline.
      'supabase/functions/**',
      // React example file kept for reference; not part of the Svelte build.
      'src/components/**/*.tsx',
      // Ad-hoc script at repo root.
      'test-import.mjs',
      // Build-time utility (needs the optional @resvg/resvg-js dep); not part
      // of the SvelteKit project.
      'scripts/generate-icons.mjs'
    ]
  },
  js.configs.recommended,
  ...ts.configs.recommendedTypeChecked,
  ...ts.configs.stylisticTypeChecked,
  ...svelte.configs['flat/recommended'],
  prettier,
  ...svelte.configs['flat/prettier'],
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: {
          // `src/service-worker.ts` is excluded from the SvelteKit tsconfig
          // (it targets the webworker, not DOM, environment), so it has no
          // configured project — lint it via the default project instead.
          allowDefaultProject: [
            '*.config.ts',
            '*.config.js',
            '.prettierrc.js',
            'src/service-worker.ts'
          ]
        },
        extraFileExtensions: ['.svelte']
      }
    }
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: {
        parser: ts.parser,
        projectService: true,
        extraFileExtensions: ['.svelte']
      }
    }
  },
  {
    rules: {
      // Enterprise-grade strictness on top of tsc's strict flags.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' }
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
      ],

      // SvelteKit-specific exceptions: `throw redirect()` / `throw error()`
      // are the documented control-flow primitives — they are NOT bugs.
      '@typescript-eslint/only-throw-error': 'off',

      // Conflicts with deliberately-defensive code at API boundaries.
      '@typescript-eslint/no-unnecessary-condition': 'off',

      // Style-only — keep type vs interface as the author chose.
      '@typescript-eslint/consistent-type-definitions': 'off',

      // Codebase uses `||` deliberately to treat '' as falsy alongside null
      // (form fields, env vars, optional strings). `??` would change behavior.
      '@typescript-eslint/prefer-nullish-coalescing': 'off',

      // FormData.get() returns FormDataEntryValue (string | File) and is
      // routinely coerced with `String(...) ?? ''` in SvelteKit actions.
      '@typescript-eslint/no-base-to-string': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',

      // Pragmatic: Svelte + Supabase code paths have many implicit-any
      // surfaces from generated types. tsc + Zod schemas already enforce
      // boundary safety; we lean on those rather than re-enforcing here.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',

      // tsconfig `noPropertyAccessFromIndexSignature` already enforces
      // the right form (bracket access for index signatures). Disabling
      // eslint's `dot-notation` avoids a tug-of-war between the two.
      '@typescript-eslint/dot-notation': 'off',

      // General code health.
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'prefer-const': 'error'
    }
  },
  {
    // Svelte 5 rune convention: `let { data } = $props()` is the documented
    // form even though TS sees the binding as never reassigned.
    files: ['**/*.svelte'],
    rules: {
      'prefer-const': 'off'
    }
  },
  {
    // Server-only code: tighten the rules that matter for boundary safety.
    // Validate untrusted input with Zod schemas before touching it as a value.
    files: [
      'src/lib/server/**/*.ts',
      'src/routes/**/+server.ts',
      'src/routes/**/+page.server.ts',
      'src/routes/**/+layout.server.ts',
      'src/hooks.server.ts'
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error'
    }
  },
  {
    files: ['**/*.test.ts', '**/*.spec.ts', 'tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'off'
    }
  },
  {
    // E2E tests live outside the SvelteKit project; lint them without
    // type-aware rules. Their own tsc step in CI catches type errors.
    files: ['e2e/**/*.ts'],
    ...ts.configs.disableTypeChecked,
    rules: {
      ...ts.configs.disableTypeChecked.rules,
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/await-thenable': 'off',
      '@typescript-eslint/switch-exhaustiveness-check': 'off',
      '@typescript-eslint/consistent-type-imports': 'off'
    }
  },
  {
    // Config files at the repo root sit outside the SvelteKit project,
    // so type-aware lint rules can't load — disable them here.
    files: ['*.config.ts', '*.config.js', 'svelte.config.js', 'eslint.config.js'],
    ...ts.configs.disableTypeChecked
  }
];
