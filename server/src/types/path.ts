import { property } from 'lodash-es';

// These are ripped from react-hook-form and slightly altered to work in a Node env - thanks!!!
export type IsEqual<T1, T2> = T1 extends T2
  ? (<G>() => G extends T1 ? 1 : 2) extends <G>() => G extends T2 ? 1 : 2
    ? true
    : false
  : false;

type ArrayKey = number;

type IsTuple<T extends ReadonlyArray<unknown>> = number extends T['length']
  ? false
  : true;

type Primitive = null | undefined | string | number | boolean | symbol | bigint;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TupleKeys<T extends ReadonlyArray<any>> = Exclude<keyof T, keyof any[]>;

type AnyIsEqual<T1, T2> = T1 extends T2
  ? IsEqual<T1, T2> extends true
    ? true
    : never
  : never;

type PathImpl<
  K extends string | number,
  V,
  TraversedTypes,
> = V extends Primitive
  ? `${K}`
  : true extends AnyIsEqual<TraversedTypes, V>
  ? `${K}`
  : `${K}` | `${K}.${PathInternal<V, TraversedTypes | V>}`;

type PathInternal<T, TraversedTypes = T> = T extends ReadonlyArray<infer V>
  ? IsTuple<T> extends true
    ? {
        [K in TupleKeys<T>]-?: PathImpl<K & string, T[K], TraversedTypes>;
      }[TupleKeys<T>]
    : PathImpl<ArrayKey, V, TraversedTypes>
  : {
      [K in keyof T]-?: PathImpl<K & string, T[K], TraversedTypes>;
    }[keyof T];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Path<T> = T extends any ? PathInternal<T> : never;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PathValue<T, P extends Path<T>> = T extends any
  ? P extends `${infer K}.${infer R}`
    ? K extends keyof T
      ? R extends Path<T[K]>
        ? PathValue<T[K], R>
        : never
      : K extends `${ArrayKey}`
      ? T extends ReadonlyArray<infer V>
        ? PathValue<V, R & Path<V>>
        : never
      : never
    : P extends keyof T
    ? T[P]
    : P extends `${ArrayKey}`
    ? T extends ReadonlyArray<infer V>
      ? V
      : never
    : never
  : never;

export function typedProperty<T, TPath extends Path<T> = Path<T>>(path: TPath) {
  return property<T, PathValue<T, TPath>>(path);
}
