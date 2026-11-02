import { describe, expect, it, vi } from 'vitest';
import type { Night } from '../src/digest/types.js';

const night: Night = {
  night: '2026-10-28',
  rows: [
    { job: 'a', owner: null, runs: 1, retries: 0, lastStatus: 'ok', lastError: null, firstAt: 't', lastAt: 't' },
  ],
  badLines: 0,
  counts: { ok: 1, retry: 0, fail: 0 },
};

vi.mock('../src/digest/read.js', () => ({
  readNight: (_dir: string, n: string) => (n === '2026-10-28' ? night : null),
}));

const { createApp } = await import('../src/app.js');
const app = createApp({ adapter: '', installed: '', beatEverySeconds: 1, runsDir: 'x' });

describe('GET /api/digest/:night', () => {
  it('returns the rows in reader order', async () => {
    const res = await app.request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(night.rows);
  });
  it('404s for a missing night', async () => {
    expect((await app.request('/api/digest/1999-01-01')).status).toBe(404);
  });
});
