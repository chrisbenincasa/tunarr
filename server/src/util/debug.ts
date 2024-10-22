import assert from 'assert';
import { isFunction } from 'lodash-es';
import { isDev } from '.';

export function devAssert(condition: boolean | (() => boolean)) {
  const res = isFunction(condition) ? condition() : condition;
  if (isDev) {
    assert(res);
  } else if (!res) {
    console.warn(new Error(), 'dev assert failed!');
  }
}
