import type { ChannelStreamMode } from '@tunarr/types';

/**
 * Channel stream modes the ErsatzTV next worker serves when the feature flag
 * is on.
 *
 * The worker only writes HLS, so `mpegts` still goes through Tunarr's concat
 * session — it reads the worker's playlist instead of Tunarr's own pipeline.
 * `hls_slower` and `hls_direct` are excluded: both are slated for deprecation,
 * and `hls_direct` remuxes without transcoding, which the worker cannot do.
 */
const EtvNextRoutableModes = new Set<ChannelStreamMode>([
  'hls',
  'hls_direct_v2',
  'mpegts',
]);

/** Whether a request for this mode should be served by the worker. */
export function routesToEtvNext(
  mode: ChannelStreamMode,
  etvNextEnabled: boolean,
): boolean {
  return etvNextEnabled && EtvNextRoutableModes.has(mode);
}
