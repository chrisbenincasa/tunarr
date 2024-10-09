import assert from 'assert';
import { isFunction } from 'lodash-es';
import { isDev } from '.';

export function devAssert(condition: boolean | (() => boolean)) {
  if (isDev) {
    assert(isFunction(condition) ? condition() : condition);
  }
}
