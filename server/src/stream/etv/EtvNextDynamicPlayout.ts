import dayjs from 'dayjs';
import { TUNARR_ENV_VARS } from '../../util/env.ts';
import type { PlayoutItem } from './generated/playout.ts';
import { PlayoutItemSchema } from './generated/playout.ts';

/**
 * How far ahead the dynamic placeholder reaches.
 *
 * Nothing is materialized behind it, so depth costs nothing. It has to be deep
 * because the worker clamps every resolved item's `finish` to the
 * placeholder's, and a shallow window would truncate a long program.
 */
export const DynamicWindowMs = 12 * 60 * 60 * 1000;

/** The window is rolled once less than this much of it is left. */
export const DynamicRollThresholdMs = 2 * 60 * 60 * 1000;

/**
 * How often the remaining span is checked.
 *
 * A check is two timestamp comparisons and writes nothing until the threshold
 * is crossed, so it is cheap enough to run far more often than it acts.
 */
export const DynamicRollCheckIntervalMs = 5 * 60 * 1000;

/** The path the worker calls back on for each item it reaches. */
export const DynamicResolverPath = '/api/etv/playout-item';

/**
 * The worker expands `{{VAR}}` from its own environment, so the session's
 * bearer token reaches the request header without landing in a file.
 */
export const DynamicTokenEnvVar = 'TUNARR_ETV_TOKEN';

/** `next` parses these with `DateTime::parse_from_rfc3339`. */
const rfc3339 = (ms: number) => dayjs(ms).format('YYYY-MM-DDTHH:mm:ss.SSSZ');

/** Bind addresses that mean every interface, where loopback also answers. */
const WildcardBindAddrs = new Set([
  '',
  '*',
  '0.0.0.0',
  '::',
  '[::]',
  '::0',
  '0:0:0:0:0:0:0:0',
]);

/**
 * The host the worker dials Tunarr back on.
 *
 * Loopback only answers when Tunarr listens on every interface. A bind address
 * naming one interface leaves nothing on 127.0.0.1, and upstream turns a
 * refused callback into silent black video.
 */
export function dynamicResolverHost(bindAddr: string | undefined): string {
  const trimmed = (bindAddr ?? '').trim();
  if (WildcardBindAddrs.has(trimmed.toLowerCase())) {
    return '127.0.0.1';
  }

  // An IPv6 literal needs brackets to sit in a URL authority.
  const bare = trimmed.replace(/^\[|\]$/g, '');
  return bare.includes(':') ? `[${bare}]` : bare;
}

export function dynamicResolverUri(
  tunarrPort: number,
  bindAddr: string | undefined = process.env[TUNARR_ENV_VARS.BIND_ADDR_ENV_VAR],
): string {
  const host = dynamicResolverHost(bindAddr);
  return `http://${host}:${tunarrPort}${DynamicResolverPath}`;
}

/**
 * The placeholder's id, which the worker echoes back as `x-etv-dynamic-id`.
 *
 * Stable across rolls. A changed id reads upstream as a different item, which
 * would restart playback at the seam.
 */
export function dynamicPlaceholderId(channelUuid: string): string {
  return `etv-dynamic-${channelUuid}`;
}

/**
 * The single item a dynamic window holds.
 *
 * It is never consumed. The worker re-resolves it every transcode tick, so one
 * placeholder yields a whole channel's programming and a lineup edit needs no
 * file written at all.
 */
export function createDynamicPlaceholder({
  channelUuid,
  startMs,
  finishMs,
  resolverUri,
}: {
  channelUuid: string;
  startMs: number;
  finishMs: number;
  resolverUri: string;
}): PlayoutItem {
  return PlayoutItemSchema.parse({
    id: dynamicPlaceholderId(channelUuid),
    start: rfc3339(startMs),
    finish: rfc3339(finishMs),
    source: {
      source_type: 'dynamic',
      uri: resolverUri,
      headers: [`Authorization: Bearer {{${DynamicTokenEnvVar}}}`],
    },
  });
}
