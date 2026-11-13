import { NextResponse, type NextRequest } from 'next/server';

import { db } from '@/lib/db';
import { enforceAccountLimit } from '@/lib/defenses';
import { handle, readJson, setSessionCookie } from '@/lib/http';
import { createSession } from '@/lib/sessions';
import { authenticate } from '@/lib/users';

export function POST(request: NextRequest) {
  return handle(request, async () => {
    const body = await readJson(request);
    const email =
      typeof body === 'object' && body !== null && 'email' in body ? String(body.email) : '';
    enforceAccountLimit(email);
    const user = await authenticate(db(), body);
    const response = NextResponse.json({ user });
    setSessionCookie(response, await createSession(db(), user.id));
    return response;
  });
}
