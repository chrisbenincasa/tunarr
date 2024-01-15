import z from 'zod';
import {
  ChannelProgramSchema,
  ChannelProgrammingSchema,
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

export type ContentProgram = Alias<z.infer<typeof ContentProgramSchema>>;

export type FlexProgram = Alias<z.infer<typeof FlexProgramSchema>>;

export type CustomProgram = Alias<z.infer<typeof CustomProgramSchema>>;

export type RedirectProgram = Alias<z.infer<typeof RedirectProgramSchema>>;

export type ChannelProgram = Alias<z.infer<typeof ChannelProgramSchema>>;

function isProgramType<T extends ChannelProgram>(type: string) {
  return (p: ChannelProgram): p is T => {
    return p.type === type;
  };
}

export const isContentProgram = isProgramType<ContentProgram>('content');

export const isFlexProgram = isProgramType<FlexProgram>('flex');

export const isRedirectProgram = isProgramType<RedirectProgram>('redirect');

export type ChannelProgramming = Alias<
  z.infer<typeof ChannelProgrammingSchema>
>;
