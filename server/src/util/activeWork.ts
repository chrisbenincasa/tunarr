import { performance } from 'node:perf_hooks';

type WorkEntry = {
  label: string;
  startedAt: number;
  endedAt?: number;
};

// Finished work stays listed this long, so a stall that ends just as its work
// finishes can still name it.
const RetainFinishedMs = 60_000;

const entries = new Set<WorkEntry>();

/**
 * Runs `fn` and records it as active work under `label` until it settles.
 * `workBetween` reads the record back.
 */
export async function trackWork<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  const entry: WorkEntry = { label, startedAt: performance.now() };
  entries.add(entry);
  try {
    return await fn();
  } finally {
    entry.endedAt = performance.now();
    pruneFinished();
  }
}

/**
 * Labels of tracked work that ran at any point between two `performance.now()`
 * timestamps, oldest first. A label appears once per run, so overlapping runs
 * of the same work show up twice.
 */
export function workBetween(fromMs: number, toMs: number): string[] {
  pruneFinished();
  const labels: string[] = [];
  for (const entry of entries) {
    const endedBefore = entry.endedAt !== undefined && entry.endedAt < fromMs;
    if (entry.startedAt <= toMs && !endedBefore) {
      labels.push(entry.label);
    }
  }
  return labels;
}

function pruneFinished() {
  const cutoff = performance.now() - RetainFinishedMs;
  for (const entry of entries) {
    if (entry.endedAt !== undefined && entry.endedAt < cutoff) {
      entries.delete(entry);
    }
  }
}
