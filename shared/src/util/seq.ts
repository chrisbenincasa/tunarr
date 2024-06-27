import { flatMap } from 'lodash-es';

export function intersperse<T>(arr: T[], v: T, makeLast: boolean = false): T[] {
  return flatMap(arr, (x, i) => (i === 0 && !makeLast ? [x] : [x, v]));
}
