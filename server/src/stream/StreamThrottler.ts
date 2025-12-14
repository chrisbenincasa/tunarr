import type { StreamLineupItem } from '@/db/derived_types/StreamLineup.js';
import type { Maybe } from '@/types/util.js';
import constants from '@tunarr/shared/constants';
import { isUndefined } from 'lodash-es';
import util from 'node:util';

type CacheEntry = {
  t0: number;
  timer?: NodeJS.Timeout | null;
  lineupItem?: StreamLineupItem;
};

const cache: Record<string, CacheEntry> = {};
let previous: CacheEntry;

// WTF is this
function equalItems(a: Maybe<StreamLineupItem>, b: Maybe<StreamLineupItem>) {
  if (
    isUndefined(a) ||
    isUndefined(b) ||
    a.type === 'offline' ||
    b.type === 'offline'
  ) {
    return false;
  }

  if (a.type !== b.type) {
    return false;
  }

  if (a.type !== 'program') {
    console.log(util.format('Unclear how to compare %O and %O', a, b));
  }

  return true;
}

// TODO: Rewrite this...it's brutal
export function wereThereTooManyAttempts(
  sessionToken: string,
  lineupItem: Maybe<StreamLineupItem>,
) {
  const obj = cache[sessionToken];
  const t1 = new Date().getTime();
  if (isUndefined(obj)) {
    previous = cache[sessionToken] = {
      t0: t1 - constants.TOO_FREQUENT * 5,
    };
  } else if (obj.timer) {
    clearTimeout(obj.timer);
  }
  previous.timer = setTimeout(() => {
    if (obj) {
      obj.timer = null;
    }
    delete cache[sessionToken];
  }, constants.TOO_FREQUENT * 5);

  let result = false;

  if (previous.t0 + constants.TOO_FREQUENT >= t1) {
    //certainly too frequent
    result = equalItems(previous.lineupItem, lineupItem);
  }
  if (obj) {
    obj.t0 = t1;
    obj.lineupItem = lineupItem;
  }
  return result;
}
