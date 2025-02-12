// Do we really need to pull in ts-essentials for this?
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export type Prettify<Type> = Type extends Function
  ? Type
  : Extract<
      {
        [Key in keyof Type]: Type[Key];
      },
      Type
    >;

// TODO: we used to use a unique symbol here, but there are some problems
// with portability. But is that something we really need to care about?
// In theory, a tagged type could be manually created with this setup...
// a private symbol would be better.
export type Tag<Typ, T> = Typ & { readonly __tag: T; readonly __value: Typ };

export const tag = <
  UTag extends { readonly __tag: unknown; readonly __value: unknown } = {
    readonly __tag: unknown;
    readonly __value: unknown;
  },
>(
  x: UTag['__value'],
): UTag => x as unknown as UTag;

export function untag<
  UTag extends { readonly __tag: unknown; readonly __value: unknown },
  Out = UTag extends { readonly __tag: unknown; readonly __value: infer OutT }
    ? OutT
    : never,
>(x: UTag): Out {
  return x as unknown as Out;
}

export function retag<
  TTag extends { readonly __tag: unknown; readonly __value: unknown } = {
    readonly __tag: unknown;
    readonly __value: unknown;
  },
  UTag extends { readonly __tag: unknown; readonly __value: unknown } = {
    readonly __tag: unknown;
    readonly __value: unknown;
  },
>(x: UTag): TTag {
  return tag<TTag>(untag(x));
}

export type TupleToUnion<T extends ReadonlyArray<unknown>> = T[number];

/**
 * Given a type of an array of 2-tuples representing "parent" and "child",
 * finds the matching "child" given the type of the "parent".
 */
export type FindChild<Target, Arr extends unknown[] = []> = Arr extends [
  [infer Head, infer Child],
  ...infer Tail,
]
  ? Head extends Target
    ? Child
    : FindChild<Target, Tail>
  : never;
