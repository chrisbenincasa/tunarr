import type { ChannelStreamMode } from '@tunarr/types';
import { describe, expect, test } from 'vitest';
import { routesToEtvNext } from './EtvNextRouting.ts';

describe('routesToEtvNext', () => {
  const allModes: ChannelStreamMode[] = [
    'hls',
    'hls_slower',
    'mpegts',
    'hls_direct',
    'hls_direct_v2',
  ];

  const routableModes: ChannelStreamMode[] = ['hls', 'hls_direct_v2', 'mpegts'];

  // Both of these are on their way out, and hls_direct remuxes without
  // transcoding, which the worker cannot do.
  const unroutableModes: ChannelStreamMode[] = ['hls_direct', 'hls_slower'];

  test.each(allModes)(
    'leaves %s alone when the flag is off and the channel has not opted in',
    (mode) => {
      expect(routesToEtvNext(mode, false, false)).toBe(false);
    },
  );

  test.each(routableModes)(
    'routes %s when the flag enrolls every channel',
    (mode) => {
      expect(routesToEtvNext(mode, true, false)).toBe(true);
    },
  );

  // The incremental path: the flag is off and the channel carries the opt-in.
  test.each(routableModes)('routes %s when the channel opts in', (mode) => {
    expect(routesToEtvNext(mode, false, true)).toBe(true);
  });

  test.each(unroutableModes)(
    'keeps %s on Tunarr even when the flag is on',
    (mode) => {
      expect(routesToEtvNext(mode, true, false)).toBe(false);
    },
  );

  // A channel cannot opt into a mode the worker has no way to serve.
  test.each(unroutableModes)(
    'keeps %s on Tunarr even when the channel opts in',
    (mode) => {
      expect(routesToEtvNext(mode, false, true)).toBe(false);
    },
  );
});
