import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectionTracker } from './ConnectionTracker.ts';

vi.mock('@/util/logging/LoggerFactory.js', () => ({
  LoggerFactory: {
    child: () => ({
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      trace: vi.fn(),
      warn: vi.fn(),
      setBindings: vi.fn(),
    }),
  },
}));

describe('ConnectionTracker', () => {
  let tracker: ConnectionTracker<any>;

  beforeEach(() => {
    vi.useFakeTimers();
    tracker = new ConnectionTracker('test-id', 'test-tracker');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('cancelCleanup', () => {
    it('cancels a pending cleanup timer', () => {
      const cleanupHandler = vi.fn();
      tracker.on('cleanup', cleanupHandler);

      tracker.scheduleCleanup(5000);
      tracker.cancelCleanup();

      // Advance past the scheduled delay — handler should NOT fire
      vi.advanceTimersByTime(10_000);

      expect(cleanupHandler).not.toHaveBeenCalled();
    });

    it('is a no-op when no cleanup is scheduled', () => {
      // Should not throw
      expect(() => tracker.cancelCleanup()).not.toThrow();
    });

    it('allows a new cleanup to be scheduled after cancellation', () => {
      const cleanupHandler = vi.fn();
      tracker.on('cleanup', cleanupHandler);

      tracker.scheduleCleanup(5000);
      tracker.cancelCleanup();

      // Schedule again
      tracker.scheduleCleanup(3000);
      vi.advanceTimersByTime(3000);

      expect(cleanupHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('scheduleCleanup', () => {
    it('emits cleanup after delay when no connections exist', () => {
      const cleanupHandler = vi.fn();
      tracker.on('cleanup', cleanupHandler);

      tracker.scheduleCleanup(5000);
      vi.advanceTimersByTime(5000);

      expect(cleanupHandler).toHaveBeenCalledTimes(1);
    });

    it('does not emit cleanup if a connection was added during the delay', () => {
      const cleanupHandler = vi.fn();
      tracker.on('cleanup', cleanupHandler);

      tracker.scheduleCleanup(5000);

      // Add connection during grace period — this clears the timer
      tracker.addConnection('token-1', { ip: '1.2.3.4' });

      vi.advanceTimersByTime(10_000);

      expect(cleanupHandler).not.toHaveBeenCalled();
    });

    it('returns false when cleanup is already scheduled', () => {
      tracker.scheduleCleanup(5000);
      const result = tracker.scheduleCleanup(5000);
      expect(result).toBe(false);
    });
  });

  describe('session replacement race condition', () => {
    it('cancelCleanup prevents stale timer from firing after session replacement', () => {
      // Simulates the race condition from the bug:
      // 1. Session A schedules cleanup (via scheduleCleanup)
      // 2. Session A is stopped and replaced by Session B
      // 3. Session A's timer fires and would delete Session B
      //
      // Fix: Session.stop() calls cancelCleanup() before stopping,
      // preventing the stale timer from ever firing.

      const cleanupA = vi.fn();
      const trackerA = new ConnectionTracker('chan-1', 'session-A');
      trackerA.on('cleanup', cleanupA);

      // Step 1: Session A has no connections, schedules cleanup
      trackerA.scheduleCleanup(15_000);

      // Step 2: Session A is stopped — cancel its cleanup timer
      trackerA.cancelCleanup();

      // Step 3: Advance time past the original delay
      vi.advanceTimersByTime(20_000);

      // The stale timer must NOT have fired
      expect(cleanupA).not.toHaveBeenCalled();
    });
  });
});
