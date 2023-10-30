import { reduce } from 'lodash-es';

type IsStringOrNumberValue<T, K extends keyof T> = T[K] extends
  | string
  | number
  | symbol
  ? T[K]
  : never;

type KeysOfType<T> = keyof {
  [Key in keyof T as T[Key] extends string | number ? Key : never]: T[Key];
};

export function groupByUniq<
  T,
  K extends KeysOfType<T>,
  Key extends IsStringOrNumberValue<T, K>,
>(data: T[], member: K): Record<Key, T> {
  return reduce(
    data,
    (prev, t) => ({ ...prev, [t[member] as Key]: t }),
    {} as Record<Key, T>,
  );
}

export function groupByFunc<T, Key extends string | number | symbol>(
  data: T[],
  func: (val: T) => Key,
): Record<Key, T> {
  return reduce(
    data,
    (prev, t) => ({ ...prev, [func(t)]: t }),
    {} as Record<Key, T>,
  );
}

export function groupByUniqAndMap<
  T,
  K extends KeysOfType<T>,
  Key extends IsStringOrNumberValue<T, K>,
  Value,
>(data: T[], member: K, mapper: (val: T) => Value): Record<Key, Value> {
  return reduce(
    data,
    (prev, t) => ({ ...prev, [t[member] as Key]: mapper(t) }),
    {} as Record<Key, Value>,
  );
}
