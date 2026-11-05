import type { PrismaClient } from '@/generated/prisma/client';

export function listProducts(prisma: PrismaClient) {
  return prisma.product.findMany({ orderBy: { name: 'asc' } });
}

export function findProduct(prisma: PrismaClient, slug: string) {
  return prisma.product.findUnique({
    where: { slug },
    include: {
      reviews: {
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true } } },
      },
    },
  });
}
