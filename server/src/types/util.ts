import type {
  DeepNonNullable,
  MarkRequired,
  StrictExclude,
} from 'ts-essentials';

export type Maybe<T> = T | undefined;

export const None = undefined;

export type Nullable<T> = T | null;

export type Nilable<T> = Maybe<T> | Nullable<T>;

export type TupleToUnion<T extends ReadonlyArray<unknown>> = T[number];

export type Intersection<X, Y> = {
  [PropX in keyof X & keyof Y]: X[PropX];
};

export type Try<T> = T | Error;

export type MarkNonNullable<Type, Keys extends keyof Type> = Type extends Type
  ? Omit<Type, Keys> & DeepNonNullable<Pick<Type, Keys>>
  : never;

export type ExcludeByValueType<T, U> = {
  [K in keyof T as T[K] extends U ? never : K]: T[K];
};

export type MarkNullable<Type, Keys extends keyof Type = keyof Type> = {
  [Key in keyof Pick<Type, Keys>]: Pick<Type, Keys>[Key] | null;
} & {
  [Key in StrictExclude<keyof Type, Keys>]: Type[Key];
};

export type MarkRequiredNotNull<
  Type,
  Keys extends keyof Type,
> = MarkNonNullable<MarkRequired<Type, Keys>, Keys>;
export type Replace<
  T extends string,
  S extends string,
  D extends string,
  A extends string = '',
> = T extends `${infer L}${S}${infer R}`
  ? Replace<R, S, D, `${A}${L}${D}`>
  : `${A}${T}`;

export type MarkNotNilable<Type, Keys extends keyof Type> = MarkNonNullable<
  MarkRequired<Type, Keys>,
  Keys
>;

export type PagedResult<T> = {
  total: number;
  results: Array<T>;
};
