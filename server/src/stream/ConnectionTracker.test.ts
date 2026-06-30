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

  describe('addConnection', () => {
    it('registers a connection and records an initial heartbeat', () => {
      tracker.addConnection('client-1', { ip: '1.2.3.4' });

      expect(tracker.isKnownConnection('client-1')).toBe(true);
      expect(tracker.numConnections()).toBe(1);
      expect(tracker.lastHeartbeat('client-1')).toBeDefined();
    });

    it('cancels a pending cleanup when a connection is added', () => {
      const cleanupHandler = vi.fn();
      tracker.on('cleanup', cleanupHandler);

      tracker.scheduleCleanup(5000);
      tracker.addConnection('client-1', { ip: '1.2.3.4' });

      vi.advanceTimersByTime(10_000);

      expect(cleanupHandler).not.toHaveBeenCalled();
    });
  });

  describe('recordHeartbeat', () => {
    it('updates the heartbeat timestamp for a known connection', () => {
      tracker.addConnection('client-1', { ip: '1.2.3.4' });
      const initialHeartbeat = tracker.lastHeartbeat('client-1');

      vi.advanceTimersByTime(5000);
      tracker.recordHeartbeat('client-1');

      expect(tracker.lastHeartbeat('client-1')).toBeGreaterThan(
        initialHeartbeat!,
      );
    });

    it('creates a ghost heartbeat entry when token is not in connections', () => {
      // This is the core of the bug: recordHeartbeat updates #heartbeats
      // but does NOT add to #connections
      tracker.recordHeartbeat('ghost-client');

      expect(tracker.lastHeartbeat('ghost-client')).toBeDefined();
      expect(tracker.isKnownConnection('ghost-client')).toBe(false);
      expect(tracker.numConnections()).toBe(0);
    });
  });

  describe('removeConnection', () => {
    it('removes a connection and its heartbeat', () => {
      tracker.addConnection('client-1', { ip: '1.2.3.4' });
      const result = tracker.removeConnection('client-1');

      expect(result).not.toBeNull();
      expect(tracker.isKnownConnection('client-1')).toBe(false);
      expect(tracker.numConnections()).toBe(0);
      expect(tracker.lastHeartbeat('client-1')).toBeUndefined();
    });

    it('returns null for unknown tokens', () => {
      expect(tracker.removeConnection('nonexistent')).toBeNull();
    });
  });

  describe('ghost heartbeat scenario (pre-fix behavior)', () => {
    it('heartbeat after removal does not restore the connection', () => {
      // Setup: add and then remove a connection
      tracker.addConnection('client-1', { ip: '1.2.3.4' });
      tracker.removeConnection('client-1');

      // Client sends a segment request → recordHeartbeat is called
      tracker.recordHeartbeat('client-1');

      // The heartbeat is recorded but the connection is NOT restored
      expect(tracker.lastHeartbeat('client-1')).toBeDefined();
      expect(tracker.isKnownConnection('client-1')).toBe(false);
      expect(tracker.numConnections()).toBe(0);
    });

    it('cleanup fires even with recent ghost heartbeats', () => {
      const cleanupHandler = vi.fn();
      tracker.on('cleanup', cleanupHandler);

      // Connection was added then removed (simulates staleness removal)
      tracker.addConnection('client-1', { ip: '1.2.3.4' });
      tracker.removeConnection('client-1');

      // Client is still active — heartbeat is fresh
      tracker.recordHeartbeat('client-1');

      // Schedule cleanup — grace period checks isEmpty(#connections)
      tracker.scheduleCleanup(5000);
      vi.advanceTimersByTime(5000);

      // Cleanup fires because #connections is empty, despite fresh heartbeat
      expect(cleanupHandler).toHaveBeenCalledTimes(1);
    });

    it('re-adding the connection via addConnection prevents cleanup', () => {
      const cleanupHandler = vi.fn();
      tracker.on('cleanup', cleanupHandler);

      // Connection removed by staleness
      tracker.addConnection('client-1', { ip: '1.2.3.4' });
      tracker.removeConnection('client-1');

      // The fix: fragment route calls addConnection to restore it
      tracker.addConnection('client-1', { ip: '1.2.3.4' });

      // Cleanup should be cancelled (addConnection clears the timer)
      // and even if we schedule new cleanup, it should abort
      tracker.scheduleCleanup(5000);
      vi.advanceTimersByTime(5000);

      // Cleanup does NOT fire because #connections is non-empty
      expect(cleanupHandler).not.toHaveBeenCalled();
      expect(tracker.isKnownConnection('client-1')).toBe(true);
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
