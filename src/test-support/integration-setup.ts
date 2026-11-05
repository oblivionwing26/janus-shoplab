// Recreates the test database schema and applies every migration before integration tests.
// Only ever touches a database whose name ends in _test.

import { execSync } from 'node:child_process';

import pg from 'pg';

export function testDatabaseUrl(): string {
  const url = process.env.DATABASE_URL_TEST;
  if (url === undefined || url === '') {
    throw new Error('DATABASE_URL_TEST is not set (see .env.example and docker compose up)');
  }
  if (!new URL(url).pathname.endsWith('_test')) {
    throw new Error(
      `Refusing to use ${new URL(url).pathname}: the database name must end in _test`,
    );
  }
  return url;
}

export default async function setup(): Promise<void> {
  const url = testDatabaseUrl();
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
    await client.query('CREATE SCHEMA public');
  } finally {
    await client.end();
  }
  execSync('pnpm exec prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
}
