import { z } from 'zod';

// We don't use the built-in Zod brand() because we want to use
// our custom branding type.
// This is the recommended approach pre z.brand(): https://github.com/colinhacks/zod/issues/3#issuecomment-794459823
export function tagSchema<TagType, T extends z.ZodTypeAny>(
  schema: T,
): z.Schema<TagType> {
  return schema as any;
}
