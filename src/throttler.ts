let constants = require('./constants');
import { isUndefined } from 'lodash';

let cache = {};
let previous;

function equalItems(a, b) {
  if (isUndefined(a) || a.isOffline || b.isOffline) {
    return false;
  }
  console.log('no idea how to compare this: ' + JSON.stringify(a));
  console.log(' with this: ' + JSON.stringify(b));
  return true;
}

export function wereThereTooManyAttempts(sessionId, lineupItem) {
  let obj = cache[sessionId];
  let t1 = new Date().getTime();
  if (isUndefined(obj)) {
    previous = cache[sessionId] = {
      t0: t1 - constants.TOO_FREQUENT * 5,
    };
  } else {
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
