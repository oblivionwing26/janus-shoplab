import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';

import { db } from './db';
import { findSessionUser, SESSION_COOKIE, SESSION_TTL_MS } from './sessions';
import { ShopError } from './shop-error';
import type { PublicUser } from './users';

/** JSON body, or {} when it is missing or malformed (validation then rejects it). */
export async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export async function requireUser(request: NextRequest): Promise<PublicUser> {
  const user = await findSessionUser(db(), request.cookies.get(SESSION_COOKIE)?.value);
  if (user === null) throw new ShopError('unauthenticated', 'Inicia sesión para continuar.');
  return user;
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ShopError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    return errorResponse(new ShopError('invalid_input', 'Revisa los campos del formulario.'));
  }
  console.error(error);
  return NextResponse.json(
    { error: { code: 'internal', message: 'Algo ha fallado. Inténtalo de nuevo.' } },
    { status: 500 },
  );
}

/** Runs a JSON route handler, turning ShopError into its status code. */
export async function handle(run: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await run();
  } catch (error) {
    return errorResponse(error);
  }
}

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.delete(SESSION_COOKIE);
}
