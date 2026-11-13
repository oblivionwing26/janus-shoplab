// The configurable defenses (F4.2) at the HTTP level: each one off by default, each one on when
// its environment variable says so, and each with the status Janus will read it by.

import { NextRequest } from 'next/server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrismaClient } from '@/generated/prisma/client';
import { addToCart } from '@/lib/cart';
import { resetDefenses, verificationCodeFor } from '@/lib/defenses';
import { createSession, SESSION_COOKIE } from '@/lib/sessions';
import { createProduct, createTestPrisma, createUser, unique } from '@/test-support/test-db';

import { POST as login } from './auth/login/route';
import { POST as logout } from './auth/logout/route';
import { POST as checkout } from './checkout/route';

let prisma: PrismaClient;

beforeAll(() => {
  prisma = createTestPrisma();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(resetDefenses);
afterEach(() => {
  vi.unstubAllEnvs();
});

function request(
  path: string,
  options: { body?: unknown; token?: string; from?: string } = {},
): NextRequest {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (options.token !== undefined) headers.set('cookie', `${SESSION_COOKIE}=${options.token}`);
  if (options.from !== undefined) headers.set('x-forwarded-for', options.from);
  return new NextRequest(`http://127.0.0.1:3100${path}`, {
    method: 'POST',
    headers,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
}

const checkoutBody = {
  shippingAddress: 'Calle de Prueba 1, 28000 Madrid',
  paymentMethod: 'test-card',
};

async function shopperWithCart() {
  const user = await createUser(prisma);
  const product = await createProduct(prisma, { priceCents: 1000 });
  await addToCart(prisma, user.id, product.id, 1);
  return { user, token: await createSession(prisma, user.id) };
}

describe('the per-client rate limit', () => {
  it('refuses a client after its share, with 429 and Retry-After, and leaves the others alone', async () => {
    vi.stubEnv('SHOPLAB_RATE_LIMIT_IP', '3/60');
    vi.stubEnv('SHOPLAB_TRUST_FORWARDED_FOR', '1');

    const statuses = [];
    for (let i = 0; i < 4; i++)
      statuses.push((await logout(request('/api/auth/logout', { from: '10.1.0.1' }))).status);
    const refused = await logout(request('/api/auth/logout', { from: '10.1.0.1' }));
    const other = await logout(request('/api/auth/logout', { from: '10.1.0.2' }));

    expect(statuses).toEqual([200, 200, 200, 429]);
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(await refused.json()).toMatchObject({ error: { code: 'rate_limited' } });
    expect(other.status).toBe(200);
  });

  it('puts every client behind the same count when it does not trust the forwarded address', async () => {
    vi.stubEnv('SHOPLAB_RATE_LIMIT_IP', '2/60');

    const first = await logout(request('/api/auth/logout', { from: '10.1.0.1' }));
    const second = await logout(request('/api/auth/logout', { from: '10.1.0.2' }));
    const third = await logout(request('/api/auth/logout', { from: '10.1.0.3' }));

    expect([first.status, second.status, third.status]).toEqual([200, 200, 429]);
  });

  it('does nothing when it is not configured', async () => {
    for (let i = 0; i < 30; i++) {
      expect((await logout(request('/api/auth/logout'))).status).toBe(200);
    }
  });
});

describe('the per-account rate limit', () => {
  it('stops guessing at one account, even with the right password, and not at another', async () => {
    vi.stubEnv('SHOPLAB_RATE_LIMIT_ACCOUNT', '3/60');
    const victim = await createUser(prisma);
    const other = await createUser(prisma);
    const guess = (email: string, password: string) =>
      login(request('/api/auth/login', { body: { email, password } }));

    const guesses = [];
    for (let i = 0; i < 3; i++)
      guesses.push((await guess(victim.email, `wrong-${String(i)}`)).status);
    const locked = await guess(victim.email, 'test-password-123');
    const untouched = await guess(other.email, 'test-password-123');

    expect(guesses).toEqual([401, 401, 401]);
    expect(locked.status).toBe(429);
    expect(await locked.json()).toMatchObject({ error: { code: 'rate_limited' } });
    expect(untouched.status).toBe(200);
  });

  it('lets anyone guess as often as they like when it is off (the behaviour so far)', async () => {
    const victim = await createUser(prisma);

    for (let i = 0; i < 10; i++) {
      const wrong = await login(
        request('/api/auth/login', { body: { email: victim.email, password: `no-${String(i)}` } }),
      );
      expect(wrong.status).toBe(401);
    }
  });
});

describe('the checkout step-up', () => {
  it('asks a new account for the code on the page, and places the order once it has it', async () => {
    vi.stubEnv('SHOPLAB_STEP_UP_CHECKOUT', 'new-accounts');
    const { user, token } = await shopperWithCart();

    const without = await checkout(request('/api/checkout', { token, body: checkoutBody }));
    const wrong = await checkout(
      request('/api/checkout', { token, body: { ...checkoutBody, verificationCode: '12ab' } }),
    );
    const placed = await checkout(
      request('/api/checkout', {
        token,
        body: { ...checkoutBody, verificationCode: verificationCodeFor(user.id) },
      }),
    );

    expect([without.status, wrong.status, placed.status]).toEqual([403, 403, 201]);
    expect(await without.json()).toMatchObject({ error: { code: 'step_up_required' } });
  });

  it('does not ask an account older than the cut-off', async () => {
    vi.stubEnv('SHOPLAB_STEP_UP_CHECKOUT', 'new-accounts');
    vi.stubEnv('SHOPLAB_STEP_UP_ACCOUNT_AGE_SECONDS', '60');
    const { user, token } = await shopperWithCart();
    await prisma.user.update({
      where: { id: user.id },
      data: { createdAt: new Date(Date.now() - 3_600_000) },
    });

    const placed = await checkout(request('/api/checkout', { token, body: checkoutBody }));

    expect(placed.status).toBe(201);
  });

  it('asks nothing when it is off, as before', async () => {
    const { token } = await shopperWithCart();

    expect((await checkout(request('/api/checkout', { token, body: checkoutBody }))).status).toBe(
      201,
    );
  });
});

describe('every defense is off by default', () => {
  it('leaves a whole shopping session untouched with no variable set', async () => {
    const { token } = await shopperWithCart();
    const email = `${unique('solo')}@shoplab.test`;

    expect(
      (await login(request('/api/auth/login', { body: { email, password: 'whatever-123' } })))
        .status,
    ).toBe(401);
    expect((await checkout(request('/api/checkout', { token, body: checkoutBody }))).status).toBe(
      201,
    );
  });
});
