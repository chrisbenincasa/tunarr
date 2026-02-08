import type { TranscodeConfigSchema } from '@tunarr/types/schemas';
import type z from 'zod';

type useTranscodeConfigFormInput = {
  initialConfig: z.input<typeof TranscodeConfigSchema>;
};

export const useTranscodeConfigForm = ({
  initialConfig,
}: useTranscodeConfigFormInput) => {};
