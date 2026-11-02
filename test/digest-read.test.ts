import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

function tempRuns(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return dir;
}

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');

  it('gives one row per job, sorted by job, and counts the bad line', () => {
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(night?.badLines).toBe(1);
    expect(night?.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
  });

  it('aggregates runs, retries, last status and error, keeping the log offset', () => {
    const row = (job: string) => night?.rows.find((r) => r.job === job);
    expect(row('lane/sync')).toEqual({
      job: 'lane/sync',
      owner: 'rook',
      runs: 8,
      retries: 1,
      lastStatus: 'ok',
      lastError: 'lock held',
      firstAt: '2026-10-28T23:00:06+01:00',
      lastAt: '2026-10-29T05:00:04+01:00',
    });
    expect(row('fixtures/refresh')).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok' });
    expect(row('notes/backup')).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded' });
    expect(row('digest/render')).toMatchObject({ owner: null, lastError: null });
  });
});

describe('readNight edges', () => {
  it('returns null when the night has no file', () => {
    expect(readNight(tempRuns({}), '2026-10-01')).toBeNull();
  });

  it('returns null for a night that is not a date, without touching the disk', () => {
    expect(readNight('runs', '../package')).toBeNull();
  });

  it('gives no rows for an empty file', () => {
    const dir = tempRuns({ '2026-10-02.jsonl': '' });
    expect(readNight(dir, '2026-10-02')).toEqual({
      night: '2026-10-02',
      rows: [],
      badLines: 0,
      counts: { ok: 0, retry: 0, fail: 0 },
    });
  });

  it('counts lines with the wrong shape as bad', () => {
    const dir = tempRuns({
      '2026-10-03.jsonl': [
        '{"at":"2026-10-03T01:00:00+01:00","job":"a","status":"done","owner":"rook"}',
        '{"at":"2026-10-03T01:00:00+01:00","status":"ok","owner":"rook"}',
        '[1,2]',
        '{"at":"2026-10-03T02:00:00+01:00","job":"a","status":"ok","owner":"rook"}',
      ].join('\n'),
    });
    const night = readNight(dir, '2026-10-03');
    expect(night?.badLines).toBe(3);
    expect(night?.rows).toHaveLength(1);
  });
});
