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

  test.each(allModes)('leaves %s alone when the flag is off', (mode) => {
    expect(routesToEtvNext(mode, false)).toBe(false);
  });

  test.each(['hls', 'hls_direct_v2', 'mpegts'] as ChannelStreamMode[])(
    'routes %s when the flag is on',
    (mode) => {
      expect(routesToEtvNext(mode, true)).toBe(true);
    },
  );

  // The worker only transcodes to HLS, so remuxing has no equivalent, and
  // both of these modes are on their way out.
  test.each(['hls_direct', 'hls_slower'] as ChannelStreamMode[])(
    'keeps %s on Tunarr even when the flag is on',
    (mode) => {
      expect(routesToEtvNext(mode, true)).toBe(false);
    },
  );
});
