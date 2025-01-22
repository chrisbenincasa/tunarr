import type { FfmpegPlaylistQuery } from '@/api/videoApi.js';
import { serverOptions } from '@/globals.js';
import { isEmpty, isNil, omitBy } from 'lodash-es';
import type { ParsedUrlQueryInput } from 'node:querystring';
import querystring from 'node:querystring';

export function makeLocalUrl(
  path: string,
  query: ParsedUrlQueryInput = {},
): string {
  const stringifiedQuery = querystring.stringify(omitBy(query, isNil));
  const urlBase = `http://localhost:${serverOptions().port}${path}`;
  if (!isEmpty(stringifiedQuery)) {
    return `${urlBase}?${stringifiedQuery}`;
  }

  return urlBase;
}

export function makeFfmpegPlaylistUrl(query: FfmpegPlaylistQuery) {
  return makeLocalUrl('/ffmpeg/playlist', query);
}
