import z from 'zod';
import {
  BaseProgramSchema,
  ChannelProgramSchema,
  ChannelProgrammingSchema,
  CondensedChannelProgramSchema,
  CondensedChannelProgrammingSchema,
  CondensedContentProgramSchema,
  ContentProgramParentSchema,
  ContentProgramSchema,
  CustomProgramSchema,
  FlexProgramSchema,
  ProgramSchema,
  ProgramTypeSchema,
  RedirectProgramSchema,
} from './schemas/programmingSchema.js';
import { ExternalIdSchema } from './schemas/utilSchemas.js';

// This helps with VS Code type preview
export type ProgramType = z.infer<typeof ProgramTypeSchema>;

export type Program = z.infer<typeof ProgramSchema>;

// Used when we only need access to very minimal set of fields that
// are shared by all program types, e.g. duration
export type BaseProgram = z.infer<typeof BaseProgramSchema>;

export type ContentProgram = z.infer<typeof ContentProgramSchema>;

export type ContentProgramParent = z.infer<typeof ContentProgramParentSchema>;

export type FlexProgram = z.infer<typeof FlexProgramSchema>;

export type CustomProgram = z.infer<typeof CustomProgramSchema>;

export type RedirectProgram = z.infer<typeof RedirectProgramSchema>;

export type ChannelProgram = z.infer<typeof ChannelProgramSchema>;

function isProgramType<T extends BaseProgram>(type: string) {
  return (p: BaseProgram): p is T => {
    return p.type === type;
  };
}

export const isContentProgram = isProgramType<ContentProgram>('content');

export const isFlexProgram = isProgramType<FlexProgram>('flex');

export const isRedirectProgram = isProgramType<RedirectProgram>('redirect');

export const isCustomProgram = isProgramType<CustomProgram>('custom');

export function programUniqueId(program: BaseProgram): string | null {
  if (isContentProgram(program)) {
    return program.uniqueId;
  } else if (isFlexProgram(program)) {
    return 'flex'; // Cannot really be unique identified
  } else if (isRedirectProgram(program)) {
    return `redirect.${program.channel}`;
  } else if (isCustomProgram(program)) {
    return `custom.${program.id}`;
  }

  return null;
}

export type ChannelProgramming = z.infer<typeof ChannelProgrammingSchema>;

export type CondensedContentProgram = z.infer<
  typeof CondensedContentProgramSchema
>;

export type CondensedChannelProgram = z.infer<
  typeof CondensedChannelProgramSchema
>;

export type CondensedChannelProgramming = z.infer<
  typeof CondensedChannelProgrammingSchema
>;

export type ExternalId = z.infer<typeof ExternalIdSchema>;
