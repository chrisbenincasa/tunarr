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

/**
 * Whether a request for this mode should be served by the worker.
 *
 * The global flag enrolls every channel. A channel's own opt-in covers the
 * period before the flag is flipped, so the two are an either-or rather than
 * a gate and a switch. Neither overrides the routable-mode list.
 */
export function routesToEtvNext(
  mode: ChannelStreamMode,
  etvNextEnabled: boolean,
  channelOptedIn: boolean,
): boolean {
  return (etvNextEnabled || channelOptedIn) && EtvNextRoutableModes.has(mode);
}
