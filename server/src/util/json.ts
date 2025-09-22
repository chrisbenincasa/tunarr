import { JSONPath } from 'jsonpath-plus';
import { first, identity, isArray } from 'lodash-es';
import { Json } from '../types/schemas.ts';
import { Nilable } from '../types/util.ts';

export function getFirstValue<Output = unknown>(
  path: string,
  json: Json,
  map: (input: unknown) => Output = identity,
): Nilable<Output> {
  const res = JSONPath<unknown>({ path, json });
  if (isArray(res)) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const f = first(res);
    return f ? map(f) : null;
  }
  return;
}
