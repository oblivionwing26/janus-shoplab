import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// `pnpm test:integration`: needs `docker compose up -d postgres`.
if (process.env.DATABASE_URL_TEST === undefined && existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['src/**/*.integration.test.ts'],
    globalSetup: ['src/test-support/integration-setup.ts'],
    // Route handlers use the app's own db(); point it at the test database.
    env: { DATABASE_URL: process.env.DATABASE_URL_TEST ?? '' },
    testTimeout: 15_000,
    hookTimeout: 60_000,
  },
});
