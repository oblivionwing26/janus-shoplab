import { randomUUID } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '@/generated/prisma/client';
import { registerUser, type PublicUser } from '@/lib/users';

import { testDatabaseUrl } from './integration-setup';

export function createTestPrisma(): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl() }) });
}

// Unique values per call, so tests never depend on each other or on order.
export function unique(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

export function createUser(prisma: PrismaClient, overrides: Partial<{ email: string }> = {}) {
  return registerUser(prisma, {
    email: overrides.email ?? `${unique('user')}@shoplab.test`,
    name: 'Test User',
    password: 'test-password-123',
    address: 'Calle de Prueba 1, 28000 Madrid',
  });
}

export function createProduct(
  prisma: PrismaClient,
  data: { priceCents: number; stock?: number; name?: string },
) {
  const slug = unique('product');
  return prisma.product.create({
    data: {
      slug,
      name: data.name ?? slug,
      description: 'Test product',
      priceCents: data.priceCents,
      stock: data.stock ?? 10,
    },
  });
}

export function createCoupon(prisma: PrismaClient, percentOff: number, active = true) {
  return prisma.coupon.create({
    data: { code: unique('COUPON').toUpperCase(), percentOff, active },
  });
}

export type { PublicUser };
