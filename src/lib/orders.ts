import { z } from 'zod';

import { Prisma, type PrismaClient } from '@/generated/prisma/client';

import { computeTotals } from './pricing';
import { ShopError } from './shop-error';

/** Simulated payment: no card or bank data is ever collected. */
export const PAYMENT_METHODS = {
  'test-card': 'Tarjeta de prueba (simulada)',
  'test-transfer': 'Transferencia de prueba (simulada)',
} as const;

export type PaymentMethod = keyof typeof PAYMENT_METHODS;

export const checkoutSchema = z.object({
  shippingAddress: z.string().trim().min(5).max(300),
  paymentMethod: z.enum(['test-card', 'test-transfer']),
});

export async function placeOrder(
  prisma: PrismaClient,
  userId: string,
  input: unknown,
): Promise<{ orderId: number }> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) throw new ShopError('invalid_input', 'Revisa la dirección y el pago.');

  try {
    return await prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findUnique({
        where: { userId },
        include: { coupon: true, items: { include: { product: true } } },
      });
      if (cart === null || cart.items.length === 0) {
        throw new ShopError('empty_cart', 'Tu carrito está vacío.');
      }
      const coupon = cart.coupon?.active === true ? cart.coupon : null;
      // Prices always come from the database, never from the request.
      const lines = cart.items.map((item) => ({
        productId: item.productId,
        name: item.product.name,
        unitPriceCents: item.product.priceCents,
        quantity: item.quantity,
      }));
      const totals = computeTotals(lines, coupon?.percentOff ?? null);

      for (const line of lines) {
        const updated = await tx.product.updateMany({
          where: { id: line.productId, stock: { gte: line.quantity } },
          data: { stock: { decrement: line.quantity } },
        });
        if (updated.count === 0) {
          throw new ShopError('out_of_stock', `No queda stock suficiente de ${line.name}.`);
        }
      }

      const order = await tx.order.create({
        data: {
          userId,
          shippingAddress: parsed.data.shippingAddress,
          paymentMethod: parsed.data.paymentMethod,
          ...totals,
          items: { create: lines },
        },
      });
      if (coupon !== null) {
        await tx.couponRedemption.create({
          data: { couponId: coupon.id, userId, orderId: order.id },
        });
      }
      await tx.cartItem.deleteMany({ where: { userId } });
      await tx.cart.update({ where: { userId }, data: { couponId: null } });
      return { orderId: order.id };
    });
  } catch (error) {
    // The (couponId, userId) primary key makes a second redemption fail.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ShopError('coupon_used', 'Ya has usado ese cupón.');
    }
    throw error;
  }
}

export function listOrders(prisma: PrismaClient, userId: string) {
  return prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { items: true },
  });
}

/** The order only if it belongs to the user; null otherwise. */
export function findOrderForUser(prisma: PrismaClient, userId: string, orderId: number) {
  return prisma.order.findFirst({ where: { id: orderId, userId }, include: { items: true } });
}
