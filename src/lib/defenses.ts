import { createHash } from 'node:crypto';

import { ShopError } from './shop-error';

// Configurable defenses (F4.2): rate limits by client and by account, and a step-up check at
// checkout. They are legitimate protections, not flaws, and every one is off unless its
// environment variable is set, so ShopLab behaves exactly as before by default. They exist so
// Janus can measure what a defense costs the people it is meant to protect (Launch Day, F4.1).
//
//   SHOPLAB_RATE_LIMIT_IP=<n>/<seconds>       requests per client in a window, on every API route
//   SHOPLAB_RATE_LIMIT_ACCOUNT=<n>/<seconds>  sign-in attempts per account (email) in a window
//   SHOPLAB_STEP_UP_CHECKOUT=new-accounts|all type a code shown on the page before confirming
//   SHOPLAB_STEP_UP_ACCOUNT_AGE_SECONDS=<s>   how long an account counts as new (default 86400)
//   SHOPLAB_TRUST_FORWARDED_FOR=1             take the client from X-Forwarded-For
//
// Without SHOPLAB_TRUST_FORWARDED_FOR every request counts as one client ("direct"): ShopLab sits
// behind no proxy of its own, so it has no honest way to tell clients apart. The sandbox sets it
// so that Janus can give each simulated visitor an address of their own.

/** The part of the environment the defenses read; `process.env` fits. */
export type Env = Readonly<Record<string, string | undefined>>;

export interface RateLimit {
  readonly limit: number;
  readonly windowMs: number;
}

export type StepUpMode = 'off' | 'new-accounts' | 'all';

export interface DefenseConfig {
  readonly ip: RateLimit | null;
  readonly account: RateLimit | null;
  readonly stepUp: { readonly mode: StepUpMode; readonly accountAgeMs: number };
  readonly trustForwardedFor: boolean;
}

/** `60/10` is 60 requests per 10 seconds. Empty means off; anything else malformed is an error. */
export function parseRateLimit(value: string | undefined, name = 'rate limit'): RateLimit | null {
  if (value === undefined || value.trim() === '') return null;
  const match = /^(\d{1,6})\/(\d{1,6})$/.exec(value.trim());
  const limit = Number(match?.[1]);
  const seconds = Number(match?.[2]);
  if (match === null || limit < 1 || seconds < 1) {
    throw new Error(`${name} must look like 60/10 (requests per seconds), got "${value}"`);
  }
  return { limit, windowMs: seconds * 1000 };
}

/** The defenses the environment asks for. Read at each request, so tests can change them. */
export function defenseConfig(env: Env = process.env): DefenseConfig {
  const mode = env.SHOPLAB_STEP_UP_CHECKOUT?.trim() ?? '';
  if (mode !== '' && mode !== 'off' && mode !== 'new-accounts' && mode !== 'all') {
    throw new Error(`SHOPLAB_STEP_UP_CHECKOUT must be off, new-accounts or all, got "${mode}"`);
  }
  const age = Number(env.SHOPLAB_STEP_UP_ACCOUNT_AGE_SECONDS ?? '86400');
  if (!Number.isFinite(age) || age < 0) {
    throw new Error('SHOPLAB_STEP_UP_ACCOUNT_AGE_SECONDS must be a number of seconds');
  }
  return {
    ip: parseRateLimit(env.SHOPLAB_RATE_LIMIT_IP, 'SHOPLAB_RATE_LIMIT_IP'),
    account: parseRateLimit(env.SHOPLAB_RATE_LIMIT_ACCOUNT, 'SHOPLAB_RATE_LIMIT_ACCOUNT'),
    stepUp: { mode: mode === '' ? 'off' : mode, accountAgeMs: age * 1000 },
    trustForwardedFor: env.SHOPLAB_TRUST_FORWARDED_FOR === '1',
  };
}

const MAX_KEYS = 10_000;

/**
 * Sliding-window counter per key. Every request counts, including the refused ones, as in the
 * usual middleware: a client that keeps hammering stays blocked until it stops for a window.
 */
export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();

  hit(
    key: string,
    { limit, windowMs }: RateLimit,
    now: number,
  ): { retryAfterSeconds: number } | null {
    const recent = (this.hits.get(key) ?? []).filter((at) => at > now - windowMs);
    recent.push(now);
    this.hits.delete(key);
    this.hits.set(key, recent);
    if (this.hits.size > MAX_KEYS) {
      const oldest = this.hits.keys().next().value;
      if (oldest !== undefined) this.hits.delete(oldest);
    }
    if (recent.length <= limit) return null;
    // Allowed again once enough of the oldest hits have left the window.
    const frees = recent[recent.length - limit - 1] ?? now;
    return { retryAfterSeconds: Math.max(1, Math.ceil((frees + windowMs - now) / 1000)) };
  }

  reset(): void {
    this.hits.clear();
  }
}

const byClient = new SlidingWindowLimiter();
const byAccount = new SlidingWindowLimiter();

/** Forget every counter (tests). */
export function resetDefenses(): void {
  byClient.reset();
  byAccount.reset();
}

const FORWARDED_ADDRESS = /^[0-9a-fA-F:.]{1,64}$/;

/** Who is asking: the first X-Forwarded-For address when trusted and well formed, else "direct". */
export function clientOf(headers: Headers, config: DefenseConfig): string {
  if (!config.trustForwardedFor) return 'direct';
  const first = headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
  return FORWARDED_ADDRESS.test(first) ? first : 'direct';
}

function refuse(scope: string, retryAfterSeconds: number): never {
  throw new ShopError(
    'rate_limited',
    `Demasiadas peticiones ${scope}. Inténtalo de nuevo en ${String(retryAfterSeconds)} segundos.`,
    retryAfterSeconds,
  );
}

/** The per-client limit, for every API route. Throws a 429 ShopError when exceeded. */
export function enforceClientLimit(
  headers: Headers,
  env: Env = process.env,
  now: number = Date.now(),
): void {
  const config = defenseConfig(env);
  if (config.ip === null) return;
  const blocked = byClient.hit(clientOf(headers, config), config.ip, now);
  if (blocked !== null) refuse('desde tu conexión', blocked.retryAfterSeconds);
}

/** The per-account limit on sign-in attempts. Throws a 429 ShopError when exceeded. */
export function enforceAccountLimit(
  email: string,
  env: Env = process.env,
  now: number = Date.now(),
): void {
  const config = defenseConfig(env);
  if (config.account === null) return;
  const blocked = byAccount.hit(email.trim().toLowerCase(), config.account, now);
  if (blocked !== null) refuse('a esta cuenta', blocked.retryAfterSeconds);
}

/** Whether checkout asks this account for the extra check. */
export function stepUpRequired(
  createdAt: Date,
  env: Env = process.env,
  now: number = Date.now(),
): boolean {
  const { mode, accountAgeMs } = defenseConfig(env).stepUp;
  if (mode === 'off') return false;
  return mode === 'all' || now - createdAt.getTime() < accountAgeMs;
}

/** The code the checkout page shows, four digits that only change with the account. */
export function verificationCodeFor(userId: string, env: Env = process.env): string {
  const secret = env.SHOPLAB_STEP_UP_SECRET ?? 'shoplab-step-up';
  const digest = createHash('sha256').update(`${secret}:${userId}`).digest();
  return String(digest.readUInt32BE(0) % 10_000).padStart(4, '0');
}

/** Throws the 403 when the check is required and the code is missing or wrong. */
export function assertStepUp(
  user: { id: string; createdAt: Date },
  input: unknown,
  env: Env = process.env,
  now: number = Date.now(),
): void {
  if (!stepUpRequired(user.createdAt, env, now)) return;
  const given =
    typeof input === 'object' && input !== null && 'verificationCode' in input
      ? String((input as { verificationCode: unknown }).verificationCode).trim()
      : '';
  if (given !== verificationCodeFor(user.id, env)) {
    throw new ShopError(
      'step_up_required',
      'Para tu seguridad, escribe el código de verificación que ves en la página.',
    );
  }
}
