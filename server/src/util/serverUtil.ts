import type { FfmpegPlaylistQuery } from '@/api/videoApi.js';
import { serverOptions } from '@/globals.js';
import { isEmpty, isNil, omitBy } from 'lodash-es';
import type { ParsedUrlQueryInput } from 'node:querystring';
import querystring from 'node:querystring';
import { TUNARR_ENV_VARS } from './env.ts';

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
 * The one interface Tunarr is bound to, formatted for a URL. Returns nothing
 * when Tunarr listens on every interface, where loopback answers.
 *
 * A bind address naming one interface leaves nothing listening on loopback,
 * so a local URL has to use that address instead.
 */
export function boundInterfaceHost(
  bindAddr: string | undefined = process.env[TUNARR_ENV_VARS.BIND_ADDR_ENV_VAR],
): string | undefined {
  const trimmed = (bindAddr ?? '').trim();
  if (WildcardBindAddrs.has(trimmed.toLowerCase())) {
    return;
  }

  // An IPv6 literal needs brackets to sit in a URL authority.
  const bare = trimmed.replace(/^\[|\]$/g, '');
  return bare.includes(':') ? `[${bare}]` : bare;
}

export function makeLocalUrl(
  path: string,
  query: ParsedUrlQueryInput = {},
): string {
  const stringifiedQuery = querystring.stringify(omitBy(query, isNil));
  const host = boundInterfaceHost() ?? 'localhost';
  const urlBase = `http://${host}:${serverOptions().port}${path}`;
  if (!isEmpty(stringifiedQuery)) {
    return `${urlBase}?${stringifiedQuery}`;
  }

  return urlBase;
}

export function makeFfmpegPlaylistUrl(query: FfmpegPlaylistQuery) {
  return makeLocalUrl('/ffmpeg/playlist', query);
}
