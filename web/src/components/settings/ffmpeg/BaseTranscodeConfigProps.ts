import type { TranscodeConfigSchema } from '@tunarr/types/schemas';
import type z from 'zod';

export type BaseTranscodeConfigProps = {
  initialConfig: z.input<typeof TranscodeConfigSchema>;
  showAdvancedSettings?: boolean;
};
