export type Maybe<T> = T | undefined;

export type Nullable<T> = T | null;

export type TupleToUnion<T extends ReadonlyArray<unknown>> = T[number];

export type Intersection<X, Y> = {
  [PropX in keyof X & keyof Y]: X[PropX];
};

export type Try<T> = T | Error;
