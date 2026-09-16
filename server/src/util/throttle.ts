/**
 * Yields the event loop for one iteration.
 *
 * `setImmediate`, not `setTimeout(fn, 0)`. Both yield — the point of the pause
 * is to let pending I/O be serviced, and an immediate queued from inside a
 * check callback runs on the *next* loop iteration, so the poll phase still
 * runs in between and I/O is still flushed. What differs is the cost per yield:
 * `setTimeout(fn, 0)` is clamped to 1ms and lands in the timers phase, so a
 * loop that yields once per item pays roughly 1.2ms of pure idle per item.
 *
 * Measured on a real guide refresh (20 channels, 96h window, median of 3):
 * build wall-clock 636ms -> 224ms, with probe p99 against a trivial endpoint
 * unchanged at 181ms -> 169ms and no failed requests. The responsiveness the
 * sleep was there to protect is not what was paying for it.
 */
export default function (): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}
