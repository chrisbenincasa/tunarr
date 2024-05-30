import querystring, { ParsedUrlQueryInput } from 'node:querystring';
import { serverOptions } from '../globals.js';
import { isEmpty } from 'lodash-es';

export function makeLocalUrl(
  path: string,
  query: ParsedUrlQueryInput = {},
): string {
  const stringifiedQuery = querystring.stringify(query);
  const urlBase = `http://localhost:${serverOptions().port}${path}`;
  if (!isEmpty(stringifiedQuery)) {
    return `${urlBase}?${stringifiedQuery}`;
  }

  return urlBase;
}
