import { isFunction } from 'lodash-es';
import assert from 'node:assert';
import { isDev } from './index';

export function devAssert(condition: boolean | (() => boolean)) {
  const res = isFunction(condition) ? condition() : condition;
  if (isDev) {
    assert(res);
  } else if (!res) {
    console.warn(new Error(), 'dev assert failed!');
  }
}
