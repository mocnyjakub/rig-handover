// Contract for plan morning-digest, section 1. Every part of section 2 builds against this file.

export type JobStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl.
export type RunLine = {
  at: string;
  job: string;
  status: JobStatus;
  owner: string | null;
  error?: string;
};

// One row per job. Times keep the offset from the log.
export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: JobStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type Night = {
  night: string;
  // Sorted by job.
  rows: DigestRow[];
  // Lines that did not parse: counted, never thrown.
  badLines: number;
  // Lines per status, across all jobs.
  counts: Record<JobStatus, number>;
};

// null when runs/<night>.jsonl does not exist. An empty file gives rows: [].
export type ReadNight = (runsDir: string, night: string) => Night | null;
