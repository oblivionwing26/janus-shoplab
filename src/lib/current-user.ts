import { cookies } from 'next/headers';

import { db } from './db';
import { findSessionUser, SESSION_COOKIE } from './sessions';
import type { PublicUser } from './users';

/** The signed-in shopper for server components, or null. */
export async function currentUser(): Promise<PublicUser | null> {
  const store = await cookies();
  return findSessionUser(db(), store.get(SESSION_COOKIE)?.value);
}
