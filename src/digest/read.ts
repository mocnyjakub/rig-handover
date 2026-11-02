import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, JobStatus, Night, ReadNight, RunLine } from './types.js';

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES: readonly JobStatus[] = ['ok', 'retry', 'fail'];

function isStatus(value: unknown): value is JobStatus {
  return typeof value === 'string' && (STATUSES as readonly string[]).includes(value);
}

export function parseLine(text: string): RunLine | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const { at, job, status, owner, error } = value as Record<string, unknown>;
  if (typeof at !== 'string' || at === '') return null;
  if (typeof job !== 'string' || job === '') return null;
  if (!isStatus(status)) return null;
  if (owner !== null && typeof owner !== 'string') return null;
  if (error !== undefined && typeof error !== 'string') return null;
  return error === undefined ? { at, job, status, owner } : { at, job, status, owner, error };
}

function addLine(rows: Map<string, DigestRow>, line: RunLine): void {
  const row = rows.get(line.job);
  if (!row) {
    rows.set(line.job, {
      job: line.job,
      owner: line.owner,
      runs: 1,
      retries: line.status === 'retry' ? 1 : 0,
      lastStatus: line.status,
      lastError: line.error ?? null,
      firstAt: line.at,
      lastAt: line.at,
    });
    return;
  }
  row.runs += 1;
  if (line.status === 'retry') row.retries += 1;
  row.owner = line.owner ?? row.owner;
  row.lastStatus = line.status;
  row.lastError = line.error ?? row.lastError;
  row.lastAt = line.at;
}

function byJob(a: DigestRow, b: DigestRow): number {
  if (a.job < b.job) return -1;
  if (a.job > b.job) return 1;
  return 0;
}

export function digest(night: string, text: string): Night {
  const rows = new Map<string, DigestRow>();
  const counts: Record<JobStatus, number> = { ok: 0, retry: 0, fail: 0 };
  let badLines = 0;
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    const line = parseLine(raw);
    if (!line) {
      badLines += 1;
      continue;
    }
    counts[line.status] += 1;
    addLine(rows, line);
  }
  const sorted = [...rows.values()].sort(byJob);
  return { night, rows: sorted, badLines, counts };
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!NIGHT.test(night)) return null;
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
  return digest(night, text);
};
