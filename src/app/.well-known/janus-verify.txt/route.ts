import { readFile } from 'node:fs/promises';

export const dynamic = 'force-dynamic';

/**
 * The ownership token Janus asks for before it may load or guess at this shop (Janus F3.1, F4.1).
 * Janus copies the token into the file named by SHOPLAB_VERIFY_FILE; without the variable, or
 * without the file, there is nothing to serve. Only the sandbox ever sets it.
 */
export async function GET(): Promise<Response> {
  const path = process.env.SHOPLAB_VERIFY_FILE;
  if (path === undefined || path === '') return new Response('Not found', { status: 404 });
  try {
    return new Response(await readFile(path, 'utf8'), {
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
