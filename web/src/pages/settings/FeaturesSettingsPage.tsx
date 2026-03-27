import {
  Box,
  Button,
  Chip,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import type { SubmitHandler } from 'react-hook-form';
import { Controller, useForm } from 'react-hook-form';
import {
  getApiSystemFeatureFlagsOptions,
  getApiSystemFeatureFlagsQueryKey,
  putApiSystemFeatureFlagsMutation,
} from '../../generated/@tanstack/react-query.gen.ts';

type FlagKey =
  | 'proxyArtwork'
  | 'tonemapEnabled'
  | 'webvttSidecarEnabled'
  | 'disableSearchSnapshotInBackup'
  | 'disableVulkan'
  | 'disableVaapiPad';

type FlagFormValues = Record<FlagKey, boolean>;

type MetaEntry = {
  key: string;
  displayName: string;
  description: string;
  category: 'experimental' | 'escape-hatch';
  envOverride: boolean;
};

function FlagSection({
  title,
  flags,
  control,
}: {
  title: string;
  flags: MetaEntry[];
  control: ReturnType<typeof useForm<FlagFormValues>>['control'];
}) {
  if (flags.length === 0) return null;

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      <Stack spacing={2}>
        {flags.map((meta) => (
          <FormControl key={meta.key} component="fieldset" fullWidth>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Controller
                name={meta.key as FlagKey}
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    label={meta.displayName}
                    control={
                      <Switch
                        {...field}
                        checked={field.value}
                        disabled={meta.envOverride}
                      />
                    }
                  />
                )}
              />
              {meta.envOverride && (
                <Chip label="Set by environment variable" size="small" />
              )}
            </Stack>
            <FormHelperText sx={{ ml: 0 }}>{meta.description}</FormHelperText>
          </FormControl>
        ))}
      </Stack>
    </Box>
  );
}

export default function FeaturesSettingsPage() {
  const { data, isPending, error } = useQuery(
    getApiSystemFeatureFlagsOptions(),
  );
  const snackbar = useSnackbar();
  const queryClient = useQueryClient();

  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty, isSubmitting },
  } = useForm<FlagFormValues>({
    defaultValues: data?.flags as FlagFormValues,
    values: data?.flags as FlagFormValues,
  });

  const updateMutation = useMutation({
    ...putApiSystemFeatureFlagsMutation(),
    onSuccess: (result) => {
      snackbar.enqueueSnackbar('Feature flags saved!', { variant: 'success' });
      reset(result.flags as FlagFormValues, { keepValues: true });
      return queryClient.invalidateQueries({
        queryKey: getApiSystemFeatureFlagsQueryKey(),
      });
    },
    onError: () => {
      snackbar.enqueueSnackbar('Failed to save feature flags.', {
        variant: 'error',
      });
    },
  });

  const onSubmit: SubmitHandler<FlagFormValues> = (values) => {
    updateMutation.mutate({ body: values });
  };

  if (isPending) {
    return null;
  }

  if (error) {
    return (
      <Typography color="error">Failed to load feature flags.</Typography>
    );
  }

  const metadata = data?.metadata ?? [];
  const experimental = metadata.filter((m) => m.category === 'experimental');
  const escapeHatches = metadata.filter((m) => m.category === 'escape-hatch');

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)}>
      <Stack spacing={4}>
        <FlagSection
          title="Experimental Features"
          flags={experimental}
          control={control}
        />
        <FlagSection
          title="Escape Hatches"
          flags={escapeHatches}
          control={control}
        />
      </Stack>
      <Stack direction="row" justifyContent="right" spacing={2} sx={{ mt: 3 }}>
        {isDirty && (
          <Button
            variant="outlined"
            onClick={() => reset(data?.flags as FlagFormValues)}
            disabled={isSubmitting}
          >
            Reset Changes
          </Button>
        )}
        <Button
          variant="contained"
          type="submit"
          disabled={!isDirty || isSubmitting}
        >
          Save
        </Button>
      </Stack>
    </Box>
  );
}
