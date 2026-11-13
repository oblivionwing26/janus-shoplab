import { NextResponse, type NextRequest } from 'next/server';

import { db } from '@/lib/db';
import { handle, readJson, setSessionCookie } from '@/lib/http';
import { createSession } from '@/lib/sessions';
import { registerUser } from '@/lib/users';

export function POST(request: NextRequest) {
  return handle(request, async () => {
    const user = await registerUser(db(), await readJson(request));
    const response = NextResponse.json({ user }, { status: 201 });
    setSessionCookie(response, await createSession(db(), user.id));
    return response;
  });
}
