import { fileURLToPath } from 'node:url';

import { configDefaults, defineConfig } from 'vitest/config';

// `pnpm test`: unit tests. No network, no database.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    exclude: [...configDefaults.exclude, '**/*.integration.test.ts'],
  },
});
