// ShopLab's own HTTP-level tests: the legitimate behaviour of every API route.
// Later fixes to ShopLab must keep them green.

import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { PrismaClient } from '@/generated/prisma/client';
import { addToCart } from '@/lib/cart';
import { SHIPPING_CENTS } from '@/lib/pricing';
import { createSession, SESSION_COOKIE } from '@/lib/sessions';
import {
  createCoupon,
  createProduct,
  createTestPrisma,
  createUser,
  unique,
} from '@/test-support/test-db';

import { POST as login } from './auth/login/route';
import { POST as logout } from './auth/logout/route';
import { POST as register } from './auth/register/route';
import { POST as applyCouponRoute } from './cart/coupon/route';
import { POST as addItem } from './cart/items/route';
import { POST as checkout } from './checkout/route';
import { GET as health } from './health/route';
import { GET as getOrder } from './orders/[id]/route';
import { POST as postReview } from './products/[slug]/reviews/route';

let prisma: PrismaClient;

beforeAll(() => {
  prisma = createTestPrisma();
});

afterAll(async () => {
  await prisma.$disconnect();
});

function request(path: string, options: { method?: string; body?: unknown; token?: string } = {}) {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (options.token !== undefined) headers.set('cookie', `${SESSION_COOKIE}=${options.token}`);
  return new NextRequest(`http://127.0.0.1:3100${path}`, {
    method: options.method ?? 'POST',
    headers,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
}

async function signedInUser() {
  const user = await createUser(prisma);
  return { user, token: await createSession(prisma, user.id) };
}

const params = <T>(value: T) => ({ params: Promise.resolve(value) });
const checkoutBody = {
  shippingAddress: 'Calle de Prueba 1, 28000 Madrid',
  paymentMethod: 'test-card',
};

describe('GET /api/health', () => {
  it('reports ok when the database answers', async () => {
    const response = await health();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });
});

describe('auth routes', () => {
  it('registers, sets an httpOnly session cookie and logs in', async () => {
    const email = `${unique('api')}@shoplab.test`;
    const body = { email, name: 'API', password: 'api-password-1', address: 'Calle API 1, Madrid' };

    const created = await register(request('/api/auth/register', { body }));
    expect(created.status).toBe(201);
    const cookie = created.headers.get('set-cookie') ?? '';
    expect(cookie).toContain(`${SESSION_COOKIE}=`);
    expect(cookie.toLowerCase()).toContain('httponly');

    const loggedIn = await login(
      request('/api/auth/login', { body: { email, password: 'api-password-1' } }),
    );
    expect(loggedIn.status).toBe(200);
    const wrong = await login(request('/api/auth/login', { body: { email, password: 'nope' } }));
    expect(wrong.status).toBe(401);
  });

  it('rejects malformed JSON as invalid input, not a server error', async () => {
    const response = await register(
      new NextRequest('http://127.0.0.1:3100/api/auth/register', {
        method: 'POST',
        body: '{not json',
      }),
    );

    expect(response.status).toBe(400);
  });

  it('ends the session on logout', async () => {
    const { token } = await signedInUser();

    await logout(request('/api/auth/logout', { token }));

    const response = await addItem(
      request('/api/cart/items', { token, body: { productId: 'x', quantity: 1 } }),
    );
    expect(response.status).toBe(401);
  });
});

describe('routes that need a session', () => {
  it('answer 401 without a session', async () => {
    const product = await createProduct(prisma, { priceCents: 100 });

    const responses = await Promise.all([
      addItem(request('/api/cart/items', { body: { productId: product.id, quantity: 1 } })),
      applyCouponRoute(request('/api/cart/coupon', { body: { code: 'X' } })),
      checkout(request('/api/checkout', { body: checkoutBody })),
      getOrder(request('/api/orders/1', { method: 'GET' }), params({ id: '1' })),
      postReview(
        request(`/api/products/${product.slug}/reviews`, { body: { rating: 5, body: 'ok' } }),
        params({ slug: product.slug }),
      ),
    ]);

    expect(responses.map((response) => response.status)).toEqual([401, 401, 401, 401, 401]);
  });
});

describe('orders', () => {
  it('returns an order to its owner and 404 to anyone else', async () => {
    const owner = await signedInUser();
    const other = await signedInUser();
    const product = await createProduct(prisma, { priceCents: 700 });
    await addToCart(prisma, owner.user.id, product.id, 1);
    const placed = await checkout(
      request('/api/checkout', { token: owner.token, body: checkoutBody }),
    );
    const { orderId } = (await placed.json()) as { orderId: number };
    const id = String(orderId);

    const mine = await getOrder(
      request(`/api/orders/${id}`, { method: 'GET', token: owner.token }),
      params({ id }),
    );
    const theirs = await getOrder(
      request(`/api/orders/${id}`, { method: 'GET', token: other.token }),
      params({ id }),
    );

    expect(mine.status).toBe(200);
    expect(theirs.status).toBe(404);
    expect(JSON.stringify(await theirs.json())).not.toContain(owner.user.address);
  });
});

describe('checkout', () => {
  it('charges database prices whatever extra fields the body carries', async () => {
    const { user, token } = await signedInUser();
    const product = await createProduct(prisma, { priceCents: 2500 });
    await addToCart(prisma, user.id, product.id, 1);

    const response = await checkout(
      request('/api/checkout', {
        token,
        body: { ...checkoutBody, totalCents: 1, items: [{ productId: product.id, priceCents: 1 }] },
      }),
    );

    expect(response.status).toBe(201);
    const { orderId } = (await response.json()) as { orderId: number };
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.totalCents).toBe(2500 + SHIPPING_CENTS);
  });

  it('redeems a coupon only once, even with simultaneous checkouts', async () => {
    const { user, token } = await signedInUser();
    const product = await createProduct(prisma, { priceCents: 1000, stock: 10 });
    const coupon = await createCoupon(prisma, 10);
    await addToCart(prisma, user.id, product.id, 2);
    await applyCouponRoute(request('/api/cart/coupon', { token, body: { code: coupon.code } }));

    await Promise.all(
      [0, 1, 2].map(() => checkout(request('/api/checkout', { token, body: checkoutBody }))),
    );

    expect(await prisma.couponRedemption.count({ where: { couponId: coupon.id } })).toBe(1);
    const orders = await prisma.order.findMany({ where: { userId: user.id } });
    expect(orders.filter((order) => order.discountCents > 0)).toHaveLength(1);
  });
});

describe('reviews', () => {
  it('stores the review text as given', async () => {
    const { token } = await signedInUser();
    const product = await createProduct(prisma, { priceCents: 100 });
    const body = 'Texto con <b>etiquetas</b> & símbolos';

    const response = await postReview(
      request(`/api/products/${product.slug}/reviews`, { token, body: { rating: 3, body } }),
      params({ slug: product.slug }),
    );

    expect(response.status).toBe(201);
    const review = await prisma.review.findFirstOrThrow({ where: { productId: product.id } });
    expect(review.body).toBe(body);
  });
});
