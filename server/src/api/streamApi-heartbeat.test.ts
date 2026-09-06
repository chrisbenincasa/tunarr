import { describe, expect, test, vi } from 'vitest';
import { shouldRefreshHeartbeatForFragment } from './streamApi.js';

vi.mock('../container.js', () => ({ container: { get: vi.fn() } }));
vi.mock('@/stream/VideoStream.js', () => ({ VideoStream: class {} }));

// Note: this unit test locks the heartbeat-gating invariant that is the fix
// for issue #2045 — a playlist-only poll must not keep a client's session
// "alive", or its pinned _minByIp segment entry would hold the HLS playlist
// window open for every other viewer.

describe('shouldRefreshHeartbeatForFragment', () => {
  test('a variant-playlist poll for HLS stream modes does NOT refresh the heartbeat', () => {
    expect(shouldRefreshHeartbeatForFragment('stream.m3u8', 'hls')).toBe(
      false,
    );
    expect(shouldRefreshHeartbeatForFragment('stream.m3u8', 'hls_direct_v2')).toBe(
      false,
    );
  });

  test('a segment request DOES refresh the heartbeat', () => {
    expect(shouldRefreshHeartbeatForFragment('data000010.ts', 'hls')).toBe(
      true,
    );
    expect(shouldRefreshHeartbeatForFragment('data000010.ts', 'hls_direct_v2')).toBe(
      true,
    );
  });

  test('a subtitle request DOES refresh the heartbeat', () => {
    expect(shouldRefreshHeartbeatForFragment('fileSequence.vtt', 'hls')).toBe(
      true,
    );
  });

  test('a non-HLS session type serves the playlist normally (no gating)', () => {
    // hls_slower has no stream.m3u8 play- poll (it serves the master via a
    // separate route), so its fragment requests keep the heartbeat as before.
    expect(shouldRefreshHeartbeatForFragment('stream.m3u8', 'hls_slower')).toBe(
      true,
    );
    expect(
      shouldRefreshHeartbeatForFragment('data000010.ts', 'hls_slower'),
    ).toBe(true);
  });
});