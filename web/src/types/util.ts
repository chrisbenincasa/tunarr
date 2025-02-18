// Turns a key/val tuple type array into a union of the "keys"
export type ExtractTypeKeys<
  Arr extends unknown[] = [],
  Acc extends unknown[] = [],
> = Arr extends []
  ? Acc
  : // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Arr extends [[infer Head, any], ...infer Tail]
    ? Head | ExtractTypeKeys<Tail>
    : never;

export type FindChild<Target, Arr extends unknown[] = []> = Arr extends [
  [infer Head, infer Child],
  ...infer Tail,
]
  ? Head extends Target
    ? Child
    : FindChild<Target, Tail>
  : never;

// TODO: Move these to shared types library
export type Maybe<T> = T | undefined;
export type Nullable<T> = T | null;
export type Nilable<T> = T | undefined | null;
export type Size = {
  width?: number;
  height?: number;
};
