import { z } from 'zod/v4';

// We don't use the built-in Zod brand() because we want to use
// our custom branding type.
// This is the recommended approach pre z.brand(): https://github.com/colinhacks/zod/issues/3#issuecomment-794459823
export function tagSchema<TagType, T extends z.ZodTypeAny>(
  schema: T,
): z.Schema<TagType> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
  return schema as any;
}

export function isValidZodLiteralUnion<T extends z.ZodLiteral>(
  literals: T[],
): literals is [T, T, ...T[]] {
  return literals.length >= 2;
}
export function constructZodLiteralUnionType<T extends z.ZodLiteral>(
  literals: T[],
) {
  if (!isValidZodLiteralUnion(literals)) {
    throw new Error(
      'Literals passed do not meet the criteria for constructing a union schema, the minimum length is 2',
    );
  }
  return z.union(literals);
}
