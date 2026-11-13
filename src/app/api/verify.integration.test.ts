// The ownership token route (Janus F4.1): served from the file the sandbox points it at.

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET as verify } from '../.well-known/janus-verify.txt/route';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('GET /.well-known/janus-verify.txt', () => {
  it('serves the token Janus put in the file the variable names', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'shoplab-verify-'));
    try {
      const file = join(dir, 'janus-verify.txt');
      await writeFile(file, 'token-123\n');
      vi.stubEnv('SHOPLAB_VERIFY_FILE', file);

      const response = await verify();

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/plain');
      expect(await response.text()).toBe('token-123\n');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('has nothing to serve without the variable, or when the file is not there yet', async () => {
    expect((await verify()).status).toBe(404);

    vi.stubEnv('SHOPLAB_VERIFY_FILE', join(tmpdir(), 'shoplab-no-such-file.txt'));
    expect((await verify()).status).toBe(404);
  });
});
