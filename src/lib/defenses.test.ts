import { beforeEach, describe, expect, it } from 'vitest';

import {
  assertStepUp,
  clientOf,
  defenseConfig,
  enforceAccountLimit,
  enforceClientLimit,
  parseRateLimit,
  resetDefenses,
  SlidingWindowLimiter,
  stepUpRequired,
  verificationCodeFor,
} from './defenses';
import { ShopError } from './shop-error';

const NOW = Date.UTC(2026, 10, 14, 10, 0, 0);
const headers = (value?: string) =>
  new Headers(value === undefined ? {} : { 'x-forwarded-for': value });

beforeEach(resetDefenses);

describe('configuration (F4.2)', () => {
  it('is all off when nothing is set, so ShopLab behaves as before', () => {
    expect(defenseConfig({})).toEqual({
      ip: null,
      account: null,
      stepUp: { mode: 'off', accountAgeMs: 86_400_000 },
      trustForwardedFor: false,
    });
  });

  it('reads limits as requests per seconds and refuses what it cannot read', () => {
    expect(parseRateLimit('60/10')).toEqual({ limit: 60, windowMs: 10_000 });
    expect(parseRateLimit(' ')).toBeNull();
    for (const bad of ['60', '0/10', '10/0', 'ten/5', '60/10/2', '-1/5']) {
      expect(() => parseRateLimit(bad, 'X')).toThrow(/must look like 60\/10/);
    }
    expect(() => defenseConfig({ SHOPLAB_STEP_UP_CHECKOUT: 'sometimes' })).toThrow(/new-accounts/);
    expect(() => defenseConfig({ SHOPLAB_STEP_UP_ACCOUNT_AGE_SECONDS: 'soon' })).toThrow();
  });
});

describe('SlidingWindowLimiter', () => {
  const limit = { limit: 3, windowMs: 10_000 };

  it('allows the limit and refuses the next, saying when to come back', () => {
    const limiter = new SlidingWindowLimiter();

    const results = [0, 1000, 2000, 3000].map((at) => limiter.hit('a', limit, NOW + at));

    expect(results.slice(0, 3)).toEqual([null, null, null]);
    expect(results[3]).toEqual({ retryAfterSeconds: 7 });
  });

  it('recovers when the window has passed, and keys do not share a count', () => {
    const limiter = new SlidingWindowLimiter();
    for (const at of [0, 1, 2, 3]) limiter.hit('a', limit, NOW + at);

    expect(limiter.hit('b', limit, NOW + 4)).toBeNull();
    expect(limiter.hit('a', limit, NOW + 20_000)).toBeNull();
  });

  it('keeps counting what it refuses: a client that keeps hammering stays blocked', () => {
    const limiter = new SlidingWindowLimiter();
    const results = [0, 3000, 6000, 9000, 12_000, 15_000].map((at) =>
      limiter.hit('a', limit, NOW + at),
    );

    expect(results.slice(0, 3)).toEqual([null, null, null]);
    expect(results.slice(3).every((blocked) => blocked !== null)).toBe(true);
  });
});

describe('who is asking', () => {
  const trusting = defenseConfig({ SHOPLAB_TRUST_FORWARDED_FOR: '1' });

  it('uses the first forwarded address only when it is trusted and well formed', () => {
    expect(clientOf(headers('10.0.0.7, 10.0.0.1'), trusting)).toBe('10.0.0.7');
    expect(clientOf(headers('fe80::1'), trusting)).toBe('fe80::1');
    expect(clientOf(headers('not an address'), trusting)).toBe('direct');
    expect(clientOf(headers(), trusting)).toBe('direct');
    expect(clientOf(headers('10.0.0.7'), defenseConfig({}))).toBe('direct');
  });
});

describe('the per-client limit', () => {
  const env = { SHOPLAB_RATE_LIMIT_IP: '2/10', SHOPLAB_TRUST_FORWARDED_FOR: '1' };

  it('refuses a client after its share with a 429 and Retry-After, and not another client', () => {
    enforceClientLimit(headers('10.0.0.1'), env, NOW);
    enforceClientLimit(headers('10.0.0.1'), env, NOW + 1);

    let refused: unknown;
    try {
      enforceClientLimit(headers('10.0.0.1'), env, NOW + 2);
    } catch (error) {
      refused = error;
    }

    expect(refused).toBeInstanceOf(ShopError);
    expect(refused).toMatchObject({ code: 'rate_limited', status: 429, retryAfterSeconds: 10 });
    expect(() => enforceClientLimit(headers('10.0.0.2'), env, NOW + 3)).not.toThrow();
  });

  it('counts everyone as one client when the forwarded address is not trusted', () => {
    const direct = { SHOPLAB_RATE_LIMIT_IP: '2/10' };
    enforceClientLimit(headers('10.0.0.1'), direct, NOW);
    enforceClientLimit(headers('10.0.0.2'), direct, NOW + 1);

    expect(() => enforceClientLimit(headers('10.0.0.3'), direct, NOW + 2)).toThrow(ShopError);
  });

  it('does nothing when it is not configured', () => {
    for (let i = 0; i < 50; i++) enforceClientLimit(headers(), {}, NOW + i);
  });
});

describe('the per-account limit', () => {
  const env = { SHOPLAB_RATE_LIMIT_ACCOUNT: '2/60' };

  it('limits sign-in attempts at one account, whatever its letter case, and not the others', () => {
    enforceAccountLimit('ana@shoplab.test', env, NOW);
    enforceAccountLimit('ANA@shoplab.test ', env, NOW + 1);

    expect(() => enforceAccountLimit('ana@shoplab.test', env, NOW + 2)).toThrow(
      expect.objectContaining({ code: 'rate_limited', status: 429 }) as Error,
    );
    expect(() => enforceAccountLimit('luis@shoplab.test', env, NOW + 3)).not.toThrow();
  });
});

describe('the checkout step-up', () => {
  const young = new Date(NOW - 60_000);
  const old = new Date(NOW - 10 * 86_400_000);

  it('asks new accounts, or everyone, and nobody when it is off', () => {
    const onlyNew = { SHOPLAB_STEP_UP_CHECKOUT: 'new-accounts' };

    expect(stepUpRequired(young, onlyNew, NOW)).toBe(true);
    expect(stepUpRequired(old, onlyNew, NOW)).toBe(false);
    expect(stepUpRequired(old, { SHOPLAB_STEP_UP_CHECKOUT: 'all' }, NOW)).toBe(true);
    expect(stepUpRequired(young, {}, NOW)).toBe(false);
    expect(
      stepUpRequired(old, { ...onlyNew, SHOPLAB_STEP_UP_ACCOUNT_AGE_SECONDS: '999999999' }, NOW),
    ).toBe(true);
  });

  it('shows a four-digit code that belongs to the account and does not change', () => {
    const code = verificationCodeFor('user-1', {});

    expect(code).toMatch(/^\d{4}$/);
    expect(verificationCodeFor('user-1', {})).toBe(code);
    expect(verificationCodeFor('user-2', {})).not.toBe(code);
  });

  it('refuses an order without the right code, and accepts it with it', () => {
    const env = { SHOPLAB_STEP_UP_CHECKOUT: 'all' };
    const user = { id: 'user-1', createdAt: young };
    const code = verificationCodeFor(user.id, env);

    expect(() => assertStepUp(user, {}, env, NOW)).toThrow(
      expect.objectContaining({ code: 'step_up_required', status: 403 }) as Error,
    );
    expect(() => assertStepUp(user, { verificationCode: '0000x' }, env, NOW)).toThrow(ShopError);
    expect(() => assertStepUp(user, { verificationCode: ` ${code} ` }, env, NOW)).not.toThrow();
    expect(() => assertStepUp(user, {}, {}, NOW)).not.toThrow();
  });
});
