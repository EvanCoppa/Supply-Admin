import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}', 'tests/**/*.{test,spec}.{js,ts}'],
    exclude: ['e2e/**', 'node_modules/**', '.svelte-kit/**'],
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'json-summary'],
      include: ['src/**/*.{ts,svelte}'],
      exclude: [
        'src/**/*.{test,spec}.ts',
        'src/**/+layout.svelte',
        'src/**/+page.svelte',
        'src/app.html',
        'src/app.d.ts',
        'src/hooks.server.ts',
        'src/lib/types/**',
        'src/lib/components/**',
        'src/routes/**'
      ],
      // Hard gates on high-blast-radius code.
      thresholds: {
        // Global floor.
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
        // Tighter gates on critical modules.
        'src/lib/server/**/*.ts': {
          lines: 80,
          functions: 80,
          branches: 75,
          statements: 80
        },
        'src/lib/schemas/**/*.ts': {
          lines: 80,
          functions: 80,
          branches: 75,
          statements: 80
        }
      }
    }
  }
});
