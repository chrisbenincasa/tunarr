import { formOptions } from '@tanstack/react-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TranscodeConfig } from '@tunarr/types';
import { TranscodeConfigSchema } from '@tunarr/types/schemas';
import { useSnackbar } from 'notistack';
import type z from 'zod';
import {
  getApiTranscodeConfigsQueryKey,
  postApiTranscodeConfigsMutation,
  putApiTranscodeConfigsByIdMutation,
} from '../../../generated/@tanstack/react-query.gen.ts';

type Opts = {
  initialConfig: z.input<typeof TranscodeConfigSchema>;
  isNew?: boolean;
  onSave: (newConfig: TranscodeConfig) => void;
};

export const useBaseTranscodeConfigFormOptions = (
  initialConfig: z.input<typeof TranscodeConfigSchema>,
) => {
  return formOptions({
    defaultValues: initialConfig,
    // mode: 'onChange',
    validators: {
      onChange: TranscodeConfigSchema,
    },
  });
};

export const useTranscodeConfigFormOptions = ({
  initialConfig,
  onSave,
  isNew,
}: Opts) => {
  const snackbar = useSnackbar();
  const baseOpts = useBaseTranscodeConfigFormOptions(initialConfig);
  const queryClient = useQueryClient();

  const updateConfigMutation = useMutation({
    ...putApiTranscodeConfigsByIdMutation(),
    onSuccess: (ret) => {
      snackbar.enqueueSnackbar('Successfully saved config!', {
        variant: 'success',
      });
      onSave(ret);
      return queryClient.invalidateQueries({
        queryKey: getApiTranscodeConfigsQueryKey(),
        exact: false,
      });
    },
    onError: (e) => {
      console.error(e);
      snackbar.enqueueSnackbar(
        'Error while saving transcode config. See console log for details.',
        {
          variant: 'error',
        },
      );
    },
  });

  const newConfigMutation = useMutation({
    ...postApiTranscodeConfigsMutation(),
    onSuccess: (ret) => {
      snackbar.enqueueSnackbar('Successfully saved config!', {
        variant: 'success',
      });
      onSave(ret);
      return queryClient.invalidateQueries({
        queryKey: getApiTranscodeConfigsQueryKey(),
        exact: false,
      });
    },
    onError: (e) => {
      console.error(e);
      snackbar.enqueueSnackbar(
        'Error while saving transcode config. See console log for details.',
        {
          variant: 'error',
        },
      );
    },
  });

  return formOptions({
    ...baseOpts,
    onSubmit: (config) => {
      const parsedConfig = TranscodeConfigSchema.parse(config.value);
      if (isNew) {
        newConfigMutation.mutate({ body: parsedConfig });
      } else {
        updateConfigMutation.mutate({
          path: { id: initialConfig.id },
          body: parsedConfig,
        });
      }
    },
  });
};
