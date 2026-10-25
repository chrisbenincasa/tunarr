import {
  defaultRule,
  type StreamSelectionProfileFormValues,
  type StreamSelectionRuleFormValues,
} from '@/components/profiles/streamSelectionFormTypes';
import { StreamSelectionPreviewPanel } from '@/components/profiles/StreamSelectionPreviewPanel';
import { StreamSelectionRuleEditor } from '@/components/profiles/StreamSelectionRuleEditor';
import {
  getApiStreamSelectionProfilesByIdOptions,
  getApiStreamSelectionProfilesQueryKey,
  postApiStreamSelectionProfilesMutation,
  putApiStreamSelectionProfilesByIdMutation,
} from '@/generated/@tanstack/react-query.gen';
import { postApiStreamSelectionProfilesValidateExpression } from '@/generated/sdk.gen';
import type { GetApiStreamSelectionProfilesByIdResponse } from '@/generated/types.gen';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { AddCircle } from '@mui/icons-material';
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useSnackbar } from 'notistack';
import { useCallback, useState } from 'react';
import {
  Controller,
  FormProvider,
  useFieldArray,
  useForm,
} from 'react-hook-form';

function profileToFormValues(
  profile: GetApiStreamSelectionProfilesByIdResponse,
): StreamSelectionProfileFormValues {
  return {
    name: profile.name,
    rules: profile.rules.map((rule) => ({
      label: rule.label ?? '',
      condition: rule.condition,
      audioAction: rule.audioAction,
      subtitleAction: rule.subtitleAction,
    })),
  };
}

function formValuesToBody(values: StreamSelectionProfileFormValues) {
  return {
    name: values.name,
    rules: values.rules.map((rule) => {
      const audioAction = cleanAudioAction(rule.audioAction);
      const subtitleAction = cleanSubtitleAction(rule.subtitleAction);
      return {
        label: rule.label || undefined,
        condition: rule.condition,
        audioAction,
        subtitleAction,
      };
    }),
  };
}

function cleanAudioAction(
  action: StreamSelectionRuleFormValues['audioAction'],
) {
  switch (action.type) {
    case 'by_language':
      return {
        type: 'by_language' as const,
        languages: action.languages,
        preferChannels:
          action.preferChannels === '' ? undefined : action.preferChannels,
      };
    case 'by_title':
      return { type: 'by_title' as const, titleContains: action.titleContains };
    case 'default':
      return { type: 'default' as const };
  }
}

function cleanSubtitleAction(
  action: StreamSelectionRuleFormValues['subtitleAction'],
) {
  switch (action.type) {
    case 'by_language':
      return {
        type: 'by_language' as const,
        languages: action.languages,
        filterType: action.filterType,
        allowImageBased: action.allowImageBased,
        allowExternal: action.allowExternal,
      };
    case 'default':
      return { type: 'default' as const };
    case 'disable':
      return { type: 'disable' as const };
  }
}

interface Props {
  isNew: boolean;
}

export function StreamSelectionProfilePage({ isNew }: Props) {
  const navigate = useNavigate();
  const snackbar = useSnackbar();
  const queryClient = useQueryClient();

  const params = useParams({ strict: false });
  const profileId = (params as Record<string, string | undefined>)['profileId'];

  const { data: existingProfile } = useQuery({
    ...getApiStreamSelectionProfilesByIdOptions({
      path: { id: profileId ?? '' },
    }),
    enabled: !isNew && profileId !== undefined,
  });

  const methods = useForm<StreamSelectionProfileFormValues>({
    defaultValues: isNew
      ? { name: '', rules: [{ ...defaultRule }] }
      : existingProfile
        ? profileToFormValues(existingProfile)
        : undefined,
    values:
      !isNew && existingProfile
        ? profileToFormValues(existingProfile)
        : undefined,
  });

  const {
    control,
    handleSubmit,
    formState: { isDirty, isValid, isSubmitting },
    reset,
  } = methods;

  const locked = existingProfile?.locked ?? false;

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'rules',
  });

  const [expandedRule, setExpandedRule] = useState<number | null>(
    isNew ? 0 : null,
  );

  const createMutation = useMutation({
    ...postApiStreamSelectionProfilesMutation(),
    onSuccess: async (data) => {
      snackbar.enqueueSnackbar(t`Profile created`, { variant: 'success' });
      await queryClient.invalidateQueries({
        queryKey: getApiStreamSelectionProfilesQueryKey(),
      });
      await navigate({
        to: '/profiles/stream-selection/$profileId',
        params: { profileId: data.uuid },
      });
    },
  });

  const updateMutation = useMutation({
    ...putApiStreamSelectionProfilesByIdMutation(),
    onSuccess: async () => {
      snackbar.enqueueSnackbar(t`Profile saved`, { variant: 'success' });
      await queryClient.invalidateQueries({
        queryKey: getApiStreamSelectionProfilesQueryKey(),
      });
      reset(methods.getValues());
    },
  });

  const duplicate = useCallback(() => {
    if (!existingProfile) {
      return;
    }
    createMutation.mutate({
      body: {
        name: t`Copy of ${existingProfile.name}`,
        rules: existingProfile.rules,
      },
    });
  }, [createMutation, existingProfile]);

  const onSubmit = useCallback(
    (values: StreamSelectionProfileFormValues) => {
      const body = formValuesToBody(values);
      if (isNew) {
        createMutation.mutate({ body });
      } else if (profileId) {
        updateMutation.mutate({ body, path: { id: profileId } });
      }
    },
    [isNew, profileId, createMutation, updateMutation],
  );

  const validateCondition = useCallback(
    async (expression: string): Promise<string | undefined> => {
      try {
        const { data } = await postApiStreamSelectionProfilesValidateExpression(
          {
            body: { expression },
          },
        );
        if (data && 'valid' in data && data.valid) {
          return undefined;
        }
        // Error response
        const errorData = data as { valid: false; error?: string } | undefined;
        return errorData?.error ?? t`Invalid expression`;
      } catch {
        return t`Failed to validate expression`;
      }
    },
    [],
  );

  const handleAddRule = useCallback(() => {
    append({ ...defaultRule });
    setExpandedRule(fields.length);
  }, [append, fields.length]);

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Typography
          component={Link}
          to="/profiles/stream-selection"
          color="inherit"
          sx={{
            textDecoration: 'none',
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          <Trans>Stream Selection Profiles</Trans>
        </Typography>
        <Typography color="text.primary">
          {isNew ? <Trans>New Profile</Trans> : (existingProfile?.name ?? '')}
        </Typography>
      </Breadcrumbs>

      <Typography variant="h4" mb={2}>
        {isNew ? (
          <Trans>New Stream Selection Profile</Trans>
        ) : locked ? (
          <Trans>View Stream Selection Profile</Trans>
        ) : (
          <Trans>Edit Stream Selection Profile</Trans>
        )}
      </Typography>

      {locked && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={duplicate}>
              <Trans>Duplicate</Trans>
            </Button>
          }
        >
          <Trans>
            This profile is built into Tunarr and cannot be changed. Duplicate
            it to make a version you can edit.
          </Trans>
        </Alert>
      )}

      <FormProvider {...methods}>
        <Box component="form" onSubmit={handleSubmit(onSubmit)}>
          <Paper sx={{ p: [2, 3], mb: 2 }}>
            <Controller
              control={control}
              name="name"
              rules={{ required: t`Profile name is required` }}
              render={({ field, fieldState: { error } }) => (
                <TextField
                  {...field}
                  label={t`Profile Name`}
                  disabled={locked}
                  error={!!error}
                  helperText={error?.message}
                  fullWidth
                  sx={{ mb: 3 }}
                />
              )}
            />

            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2,
              }}
            >
              <Typography variant="h6">
                <Trans>Rules</Trans>
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddCircle />}
                onClick={handleAddRule}
                sx={{ display: locked ? 'none' : undefined }}
              >
                <Trans>Add Rule</Trans>
              </Button>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              <Trans>
                Rules are evaluated in order. The first rule whose condition
                matches determines the audio and subtitle streams for playback.
              </Trans>
            </Typography>

            <Stack spacing={1}>
              {fields.map((field, index) => (
                <StreamSelectionRuleEditor
                  key={field.id}
                  index={index}
                  totalRules={fields.length}
                  expanded={expandedRule === index}
                  onToggleExpand={() =>
                    setExpandedRule(expandedRule === index ? null : index)
                  }
                  onMoveUp={() => {
                    move(index, index - 1);
                    setExpandedRule(index - 1);
                  }}
                  onMoveDown={() => {
                    move(index, index + 1);
                    setExpandedRule(index + 1);
                  }}
                  onRemove={() => {
                    remove(index);
                    if (expandedRule === index) {
                      setExpandedRule(null);
                    } else if (expandedRule !== null && expandedRule > index) {
                      setExpandedRule(expandedRule - 1);
                    }
                  }}
                  onValidateCondition={validateCondition}
                  readOnly={locked}
                />
              ))}
            </Stack>
          </Paper>

          <Stack
            direction="row"
            spacing={2}
            justifyContent="flex-end"
            sx={{ mt: 2, display: locked ? 'none' : undefined }}
          >
            {isDirty && (
              <Button
                variant="outlined"
                onClick={() =>
                  reset(
                    isNew
                      ? { name: '', rules: [{ ...defaultRule }] }
                      : existingProfile
                        ? profileToFormValues(existingProfile)
                        : undefined,
                  )
                }
              >
                <Trans>Reset Changes</Trans>
              </Button>
            )}
            <Button
              variant="contained"
              type="submit"
              disabled={!isDirty || !isValid || isSubmitting}
            >
              {isNew ? <Trans>Create Profile</Trans> : <Trans>Save</Trans>}
            </Button>
          </Stack>
        </Box>

        {/* Outside the form so Enter in the program search cannot submit it */}
        <Box sx={{ mt: 3 }}>
          <StreamSelectionPreviewPanel
            getRules={() => formValuesToBody(methods.getValues()).rules}
            canRun={isValid}
          />
        </Box>
      </FormProvider>
    </Box>
  );
}
