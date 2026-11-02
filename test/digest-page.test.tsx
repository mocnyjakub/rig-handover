import { describe, expect, it, vi } from 'vitest';
import type { Night } from '../src/digest/types.js';

const nights: Record<string, Night> = {
  '2026-10-28': {
    night: '2026-10-28',
    rows: [
      { job: 'a', owner: null, runs: 4, retries: 3, lastStatus: 'fail', lastError: 'boom', firstAt: 't1', lastAt: 't2' },
      { job: 'b', owner: 'x', runs: 1, retries: 0, lastStatus: 'ok', lastError: null, firstAt: 't1', lastAt: 't1' },
    ],
    badLines: 0,
    counts: { ok: 1, retry: 3, fail: 1 },
  },
  '2026-10-27': { night: '2026-10-27', rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 } },
};
vi.mock('../src/digest/read.js', () => ({ readNight: (_d: string, n: string) => nights[n] ?? null }));

const { createApp } = await import('../src/app.js');
const config = { adapter: 'shim', installed: 'x', beatEverySeconds: 60, runsDir: 'runs' };

describe('digest page', () => {
  it('marks fail and 3+ retries, shows — for null owner', async () => {
    const res = await createApp(config).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('✗ fail');
    expect(html).toContain('3 ⚠');
    expect(html).toContain('—');
  });
  it('empty night says nothing ran', async () => {
    const html = await (await createApp(config).request('/digest/2026-10-27')).text();
    expect(html).toContain('nothing ran');
  });
  it('404 without file', async () => {
    expect((await createApp(config).request('/digest/2026-01-01')).status).toBe(404);
  });
});
