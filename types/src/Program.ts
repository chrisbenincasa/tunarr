import z from 'zod';
import {
  BaseProgramSchema,
  ChannelProgramSchema,
  ChannelProgrammingSchema,
  CondensedChannelProgramSchema,
  CondensedChannelProgrammingSchema,
  CondensedContentProgramSchema,
  ContentProgramSchema,
  CustomProgramSchema,
  FlexProgramSchema,
  ProgramTypeSchema,
  RedirectProgramSchema,
} from './schemas/programmingSchema.js';
import { ProgramSchema } from './schemas/programmingSchema.js';

// This helps with VS Code type preview
type Alias<t> = t & { _?: never };

export type ProgramType = z.infer<typeof ProgramTypeSchema>;

export type Program = Alias<z.infer<typeof ProgramSchema>>;

// Used when we only need access to very minimal set of fields that
// are shared by all program types, e.g. duration
export type BaseProgram = Alias<z.infer<typeof BaseProgramSchema>>;

export type ContentProgram = Alias<z.infer<typeof ContentProgramSchema>>;

export type FlexProgram = Alias<z.infer<typeof FlexProgramSchema>>;

export type CustomProgram = Alias<z.infer<typeof CustomProgramSchema>>;

export type RedirectProgram = Alias<z.infer<typeof RedirectProgramSchema>>;

export type ChannelProgram = Alias<z.infer<typeof ChannelProgramSchema>>;

function isProgramType<T extends BaseProgram>(type: string) {
  return (p: BaseProgram): p is T => {
    return p.type === type;
  };
}

export const isContentProgram = isProgramType<ContentProgram>('content');

export const isFlexProgram = isProgramType<FlexProgram>('flex');

export const isRedirectProgram = isProgramType<RedirectProgram>('redirect');

export const isCustomProgram = isProgramType<CustomProgram>('custom');

export type ChannelProgramming = Alias<
  z.infer<typeof ChannelProgrammingSchema>
>;

export type CondensedContentProgram = Alias<
  z.infer<typeof CondensedContentProgramSchema>
>;

export type CondensedChannelProgram = Alias<
  z.infer<typeof CondensedChannelProgramSchema>
>;

export type CondensedChannelProgramming = Alias<
  z.infer<typeof CondensedChannelProgrammingSchema>
>;
