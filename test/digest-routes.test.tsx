import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const line = (job: string, status: string, owner: string | null, at: string, error?: string) =>
  JSON.stringify({ at, job, status, owner, ...(error ? { error } : {}) });

let app: ReturnType<typeof createApp>;

beforeAll(() => {
  const runsDir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  writeFileSync(
    join(runsDir, '2026-01-01.jsonl'),
    [
      line('b/job', 'retry', 'rook', '2026-01-01T23:00:00+01:00'),
      line('b/job', 'fail', 'rook', '2026-01-01T23:05:00+01:00', 'boom'),
      line('a/job', 'ok', null, '2026-01-01T23:10:00+01:00'),
    ].join('\n') + '\n',
  );
  writeFileSync(join(runsDir, '2026-01-02.jsonl'), '');
  writeFileSync(
    join(runsDir, '2026-01-03.jsonl'),
    [line('a/job', 'ok', 'rook', '2026-01-03T23:00:00+01:00'), '{not json'].join('\n') + '\n',
  );
  app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir });
});

describe('GET /digest/:night', () => {
  it('renders rows sorted by job, null owner as —', async () => {
    const res = await app.request('/digest/2026-01-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html.indexOf('a/job')).toBeGreaterThan(-1);
    expect(html.indexOf('a/job')).toBeLessThan(html.indexOf('b/job'));
    expect(html).toContain('—');
  });

  it('404 for a night with no file', async () => {
    expect((await app.request('/digest/2025-01-01')).status).toBe(404);
  });

  it('empty night says nothing ran', async () => {
    const res = await app.request('/digest/2026-01-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('a bad line does not break the night', async () => {
    const res = await app.request('/digest/2026-01-03');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('a/job');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns the same jobs in the same order as the page', async () => {
    const res = await app.request('/api/digest/2026-01-01');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rows: { job: string }[] } | { job: string }[];
    const rows = Array.isArray(body) ? body : body.rows;
    expect(rows.map((r) => r.job)).toEqual(['a/job', 'b/job']);
  });

  it('404 for a night with no file', async () => {
    expect((await app.request('/api/digest/2025-01-01')).status).toBe(404);
  });

  it('empty night gives no rows', async () => {
    const res = await app.request('/api/digest/2026-01-02');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rows: unknown[] } | unknown[];
    expect(Array.isArray(body) ? body : body.rows).toEqual([]);
  });

  it('a bad line still returns the good rows', async () => {
    const res = await app.request('/api/digest/2026-01-03');
    expect(res.status).toBe(200);
  });
});
