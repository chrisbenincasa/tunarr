import constants from '@tunarr/shared/constants';
import { isUndefined } from 'lodash-es';
import { StreamLineupItem } from './dao/derived_types/StreamLineup';
import { Maybe } from './types';

type CacheEntry = {
  t0: number;
  timer?: NodeJS.Timeout | null;
  lineupItem?: StreamLineupItem;
};

const cache: Record<number, CacheEntry> = {};
let previous: CacheEntry;

// WTF is this
function equalItems(a: Maybe<StreamLineupItem>, b: Maybe<StreamLineupItem>) {
  if (isUndefined(a) || a.type === 'offline' || b?.type === 'offline') {
    return false;
  }
  console.log('no idea how to compare this: ' + JSON.stringify(a));
  console.log(' with this: ' + JSON.stringify(b));
  return true;
}

// TODO: Rewrite this...it's brutal
export function wereThereTooManyAttempts(
  sessionId: number,
  lineupItem: Maybe<StreamLineupItem>,
) {
  const obj = cache[sessionId];
  const t1 = new Date().getTime();
  if (isUndefined(obj)) {
    previous = cache[sessionId] = {
      t0: t1 - constants.TOO_FREQUENT * 5,
    };
  } else if (obj.timer) {
    clearTimeout(obj.timer);
  }
  previous.timer = setTimeout(() => {
    cache[sessionId].timer = null;
    delete cache[sessionId];
  }, constants.TOO_FREQUENT * 5);

  let result = false;

  if (previous.t0 + constants.TOO_FREQUENT >= t1) {
    //certainly too frequent
    result = equalItems(previous.lineupItem, lineupItem);
  }
  cache[sessionId].t0 = t1;
  cache[sessionId].lineupItem = lineupItem;
  return result;
}
