import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { PrismaClient } from '@/generated/prisma/client';
import {
  createCoupon,
  createProduct,
  createTestPrisma,
  createUser,
  unique,
} from '@/test-support/test-db';

import { addToCart, applyCoupon, getCart, removeFromCart, setCartQuantity } from './cart';
import { findOrderForUser, listOrders, placeOrder } from './orders';
import { SHIPPING_CENTS } from './pricing';
import { addReview } from './reviews';
import { createSession, deleteSession, findSessionUser } from './sessions';
import { ShopError } from './shop-error';
import { authenticate, registerUser } from './users';

let prisma: PrismaClient;

beforeAll(() => {
  prisma = createTestPrisma();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function expectShopError(promise: Promise<unknown>, code: ShopError['code']) {
  const error: unknown = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(ShopError);
  expect((error as ShopError).code).toBe(code);
}

const checkout = { shippingAddress: 'Calle de Prueba 1, 28000 Madrid', paymentMethod: 'test-card' };

describe('accounts and sessions', () => {
  it('registers, rejects a duplicate email and authenticates', async () => {
    const email = `${unique('ana')}@shoplab.test`;
    const user = await createUser(prisma, { email });

    expect(user.email).toBe(email);
    await expectShopError(createUser(prisma, { email: email.toUpperCase() }), 'email_taken');
    await expect(
      authenticate(prisma, { email, password: 'test-password-123' }),
    ).resolves.toMatchObject({ id: user.id });
    await expectShopError(
      authenticate(prisma, { email, password: 'wrong-password' }),
      'invalid_credentials',
    );
  });

  it('rejects invalid registration input', async () => {
    await expectShopError(
      registerUser(prisma, { email: 'not-an-email', name: '', password: 'short', address: '' }),
      'invalid_input',
    );
  });

  it('stores only a hash of the session token and can end the session', async () => {
    const user = await createUser(prisma);
    const token = await createSession(prisma, user.id);

    expect(await findSessionUser(prisma, token)).toMatchObject({ id: user.id });
    expect(await prisma.session.count({ where: { tokenHash: token } })).toBe(0);

    await deleteSession(prisma, token);
    expect(await findSessionUser(prisma, token)).toBeNull();
    expect(await findSessionUser(prisma, undefined)).toBeNull();
  });
});

describe('cart', () => {
  it('adds, updates and removes items with totals from the database', async () => {
    const user = await createUser(prisma);
    const product = await createProduct(prisma, { priceCents: 1250, stock: 5 });

    await addToCart(prisma, user.id, product.id, 2);
    await addToCart(prisma, user.id, product.id, 1);
    let cart = await getCart(prisma, user.id);
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]?.quantity).toBe(3);
    expect(cart.totals.subtotalCents).toBe(3750);
    expect(cart.totals.shippingCents).toBe(SHIPPING_CENTS);

    await setCartQuantity(prisma, user.id, product.id, 1);
    cart = await getCart(prisma, user.id);
    expect(cart.totals.subtotalCents).toBe(1250);

    await removeFromCart(prisma, user.id, product.id);
    expect((await getCart(prisma, user.id)).lines).toEqual([]);
  });

  it('refuses more than the stock', async () => {
    const user = await createUser(prisma);
    const product = await createProduct(prisma, { priceCents: 100, stock: 2 });

    await expectShopError(addToCart(prisma, user.id, product.id, 3), 'out_of_stock');
  });

  it('applies a valid coupon and rejects unknown or inactive ones', async () => {
    const user = await createUser(prisma);
    const product = await createProduct(prisma, { priceCents: 2000 });
    const coupon = await createCoupon(prisma, 10);
    const inactive = await createCoupon(prisma, 50, false);
    await addToCart(prisma, user.id, product.id, 1);

    await applyCoupon(prisma, user.id, coupon.code.toLowerCase());
    const cart = await getCart(prisma, user.id);
    expect(cart.coupon).toEqual({ code: coupon.code, percentOff: 10 });
    expect(cart.totals.discountCents).toBe(200);

    await expectShopError(applyCoupon(prisma, user.id, 'NOPE'), 'coupon_invalid');
    await expectShopError(applyCoupon(prisma, user.id, inactive.code), 'coupon_invalid');
  });
});

describe('checkout and orders', () => {
  it('places an order with database prices, decrements stock and clears the cart', async () => {
    const user = await createUser(prisma);
    const product = await createProduct(prisma, { priceCents: 3000, stock: 4 });
    const coupon = await createCoupon(prisma, 20);
    await addToCart(prisma, user.id, product.id, 2);
    await applyCoupon(prisma, user.id, coupon.code);

    const { orderId } = await placeOrder(prisma, user.id, checkout);

    const order = await findOrderForUser(prisma, user.id, orderId);
    expect(order).toMatchObject({
      subtotalCents: 6000,
      discountCents: 1200,
      shippingCents: SHIPPING_CENTS,
      totalCents: 6000 - 1200 + SHIPPING_CENTS,
      paymentMethod: 'test-card',
    });
    expect(order?.items).toEqual([
      expect.objectContaining({ productId: product.id, unitPriceCents: 3000, quantity: 2 }),
    ]);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(2);
    expect(await getCart(prisma, user.id)).toMatchObject({ lines: [], coupon: null });
  });

  it('lets each user redeem a coupon only once', async () => {
    const user = await createUser(prisma);
    const product = await createProduct(prisma, { priceCents: 1000 });
    const coupon = await createCoupon(prisma, 10);
    await addToCart(prisma, user.id, product.id, 1);
    await applyCoupon(prisma, user.id, coupon.code);
    await placeOrder(prisma, user.id, checkout);

    await expectShopError(applyCoupon(prisma, user.id, coupon.code), 'coupon_used');
  });

  it('rejects an empty cart and invalid checkout input', async () => {
    const user = await createUser(prisma);

    await expectShopError(placeOrder(prisma, user.id, checkout), 'empty_cart');
    await expectShopError(
      placeOrder(prisma, user.id, { shippingAddress: '', paymentMethod: 'real-card' }),
      'invalid_input',
    );
  });

  it('shows an order only to its owner', async () => {
    const owner = await createUser(prisma);
    const other = await createUser(prisma);
    const product = await createProduct(prisma, { priceCents: 500 });
    await addToCart(prisma, owner.id, product.id, 1);
    const { orderId } = await placeOrder(prisma, owner.id, checkout);

    expect(await findOrderForUser(prisma, owner.id, orderId)).not.toBeNull();
    expect(await findOrderForUser(prisma, other.id, orderId)).toBeNull();
    expect(await listOrders(prisma, other.id)).toEqual([]);
  });
});

describe('reviews', () => {
  it('adds a review to a product', async () => {
    const user = await createUser(prisma);
    const product = await createProduct(prisma, { priceCents: 100 });

    await addReview(prisma, user.id, product.slug, { rating: '4', body: 'Buen producto' });

    const reviews = await prisma.review.findMany({ where: { productId: product.id } });
    expect(reviews).toEqual([expect.objectContaining({ rating: 4, body: 'Buen producto' })]);
    await expectShopError(
      addReview(prisma, user.id, product.slug, { rating: 9, body: '' }),
      'invalid_input',
    );
  });
});
