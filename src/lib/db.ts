import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '@/generated/prisma/client';

const globalForPrisma = globalThis as unknown as { shoplabPrisma?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString === undefined || connectionString === '') {
    throw new Error('DATABASE_URL is not set');
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

// One client per process; dev hot reload would otherwise open a pool on every change.
export function db(): PrismaClient {
  globalForPrisma.shoplabPrisma ??= createClient();
  return globalForPrisma.shoplabPrisma;
}
