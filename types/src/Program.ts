import z from 'zod';
import { ProgramTypeSchema } from './schemas/programmingSchema.js';
import { ProgramSchema } from './schemas/programmingSchema.js';

// This helps with VS Code type preview
type Alias<t> = t & { _: never };

export type ProgramType = z.infer<typeof ProgramTypeSchema>;

export type Program = Alias<z.infer<typeof ProgramSchema>>;
