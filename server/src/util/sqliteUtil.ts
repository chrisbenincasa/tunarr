import { isNil } from 'lodash-es';
import type { Nilable } from '../types/util.ts';

export function booleanToNumber(b: Nilable<boolean>): number {
  return b ? 1 : 0;
}

export function numberToBoolean(n: number): boolean {
  return isNil(n) || n === 0 ? false : true;
}
