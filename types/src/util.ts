// TODO: we used to use a unique symbol here, but there are some problems
// with portability. But is that something we really need to care about?
// In theory, a tagged type could be manually created with this setup...
// a private symbol would be better.
export type Tag<Typ, T> = Typ & { __tag: T };

export const tag = <
  TTag extends Tag<unknown, unknown>,
  Base = TTag extends Tag<infer BBase, unknown> ? BBase : never,
  TagType = TTag extends Tag<unknown, infer BaseTag> ? BaseTag : never,
  FinalTagType = Tag<Base, TagType>,
>(
  x: Base,
): FinalTagType => x as unknown as FinalTagType;

export type TupleToUnion<T extends ReadonlyArray<unknown>> = T[number];
