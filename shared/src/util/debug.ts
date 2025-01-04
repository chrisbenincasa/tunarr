import { isFunction } from 'lodash-es';

export function devAssert(condition: boolean | (() => boolean)) {
  const res = isFunction(condition) ? condition() : condition;
  if (!res) {
    console.warn(new Error(), 'dev assert failed!');
  }
}
