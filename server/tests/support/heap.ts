import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';

setFlagsFromString('--expose-gc');
const gc = runInNewContext('gc') as () => void;

export type HeapSample = {
  baselineBytes: number;
  peakBytes: number;
  /** Peak heap above the baseline taken before the operation started. */
  peakDeltaBytes: number;
};

/**
 * Samples `heapUsed` while an operation runs and reports the peak above a
 * post-GC baseline.
 *
 * better-sqlite3 queries are synchronous, so the sampler only runs when the
 * operation yields. The program loaders yield between chunks, which is when
 * the accumulated results are live, so the samples land where the heap is
 * fullest. A final sample after the operation resolves covers its result.
 */
export async function measurePeakHeap<T>(
  operation: () => Promise<T>,
  intervalMs = 1,
): Promise<HeapSample & { result: T }> {
  gc();
  const baselineBytes = process.memoryUsage().heapUsed;
  let peakBytes = baselineBytes;
  const sample = () => {
    peakBytes = Math.max(peakBytes, process.memoryUsage().heapUsed);
  };

  const timer = setInterval(sample, intervalMs);
  try {
    const result = await operation();
    sample();
    return {
      result,
      baselineBytes,
      peakBytes,
      peakDeltaBytes: peakBytes - baselineBytes,
    };
  } finally {
    clearInterval(timer);
    gc();
  }
}

export function formatMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
