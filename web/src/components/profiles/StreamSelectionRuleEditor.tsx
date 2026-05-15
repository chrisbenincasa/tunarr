import { msg, t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import {
  Delete,
  DragIndicator,
  ExpandMore,
  KeyboardArrowDown,
  KeyboardArrowUp,
} from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Autocomplete,
  Box,
  Chip,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { LanguageAutocomplete } from '../LanguageAutocomplete.tsx';
import type {
  AudioAction,
  StreamSelectionProfileFormValues,
  SubtitleAction,
} from './streamSelectionFormTypes';

// ISO 639-1 common languages for the autocomplete
const COMMON_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ru', label: 'Russian' },
  { code: 'ar', label: 'Arabic' },
  { code: 'hi', label: 'Hindi' },
  { code: 'nl', label: 'Dutch' },
  { code: 'sv', label: 'Swedish' },
  { code: 'no', label: 'Norwegian' },
  { code: 'da', label: 'Danish' },
  { code: 'fi', label: 'Finnish' },
  { code: 'pl', label: 'Polish' },
  { code: 'cs', label: 'Czech' },
  { code: 'th', label: 'Thai' },
] as const;

interface Props {
  index: number;
  totalRules: number;
  expanded: boolean;
  onToggleExpand: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onValidateCondition: (expression: string) => Promise<string | undefined>;
}

function getAudioSummary(audioType: AudioAction['type']) {
  switch (audioType) {
    case 'by_language':
      return msg`By Language`;
    case 'by_title':
      return msg`By Title`;
    case 'default':
      return msg`Default`;
  }
}

function getSubtitleSummary(subtitleType: SubtitleAction['type']) {
  switch (subtitleType) {
    case 'by_language':
      return msg`By Language`;
    case 'default':
      return msg`Default`;
    case 'disable':
      return msg`Disable`;
  }
}

export function StreamSelectionRuleEditor({
  index,
  totalRules,
  expanded,
  onToggleExpand,
  onMoveUp,
  onMoveDown,
  onRemove,
  onValidateCondition,
}: Props) {
  const { control } = useFormContext<StreamSelectionProfileFormValues>();

  const prefix = `rules.${index}` as const;
  const [audioType, subtitleType, label, condition] = useWatch({
    control,
    name: [
      `${prefix}.audioAction.type`,
      `${prefix}.subtitleAction.type`,
      `${prefix}.label`,
      `${prefix}.condition`,
    ],
  });

  return (
    <Accordion expanded={expanded} onChange={onToggleExpand}>
      <AccordionSummary
        expandIcon={<ExpandMore />}
        sx={{ '& .MuiAccordionSummary-content': { alignItems: 'center' } }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
          <DragIndicator
            fontSize="small"
            sx={{ color: 'text.secondary', mr: 0.5 }}
          />
          <Typography variant="subtitle2" sx={{ minWidth: 60 }}>
            <Trans>Rule {index + 1}</Trans>
          </Typography>
          {!expanded && (
            <>
              {label && <Chip label={label} size="small" variant="outlined" />}
              <Typography
                variant="body2"
                color="text.secondary"
                noWrap
                sx={{ maxWidth: 200 }}
              >
                {condition || t`No condition`}
              </Typography>
              <Chip
                label={t`Audio` + ':' + t(getAudioSummary(audioType))}
                size="small"
                color="primary"
                variant="outlined"
              />
              <Chip
                label={t`Subs` + ':' + t(getSubtitleSummary(subtitleType))}
                size="small"
                color="secondary"
                variant="outlined"
              />
            </>
          )}
        </Box>
        <Stack direction="row" spacing={0} onClick={(e) => e.stopPropagation()}>
          <Tooltip title={t`Move up`}>
            <span>
              <IconButton
                size="small"
                disabled={index === 0}
                onClick={onMoveUp}
              >
                <KeyboardArrowUp fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={t`Move down`}>
            <span>
              <IconButton
                size="small"
                disabled={index === totalRules - 1}
                onClick={onMoveDown}
              >
                <KeyboardArrowDown fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={t`Remove rule`}>
            <span>
              <IconButton
                size="small"
                disabled={totalRules <= 1}
                onClick={onRemove}
              >
                <Delete fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={3}>
          {/* Label */}
          <Controller
            control={control}
            name={`${prefix}.label`}
            render={({ field }) => (
              <TextField
                {...field}
                value={field.value ?? ''}
                label={t`Label`}
                helperText={t`Optional friendly name for this rule`}
                size="small"
              />
            )}
          />

          {/* Condition */}
          <Controller
            control={control}
            name={`${prefix}.condition`}
            rules={{
              required: t`Condition is required`,
              validate: async (value) => {
                if (!value) return t`Condition is required`;
                return onValidateCondition(value);
              },
            }}
            render={({ field, fieldState: { error } }) => (
              <TextField
                {...field}
                label={t`Condition`}
                helperText={
                  error?.message ??
                  t`CEL expression. Use "true" to always match.`
                }
                error={!!error}
                size="small"
                placeholder="true"
              />
            )}
          />

          <Box>
            <Typography variant="subtitle1" gutterBottom>
              <Trans>Audio Selection</Trans>
            </Typography>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              <Trans>
                Which audio track(s) to select when the condition holds
              </Trans>
            </Typography>
            <Stack spacing={2}>
              <Controller
                control={control}
                name={`${prefix}.audioAction.type`}
                render={({ field }) => (
                  <FormControl size="small" sx={{ maxWidth: 300 }}>
                    <InputLabel>
                      <Trans>Audio Strategy</Trans>
                    </InputLabel>
                    <Select {...field} label={t`Audio Strategy`}>
                      <MenuItem value="default">
                        <Trans>Default (first stream)</Trans>
                      </MenuItem>
                      <MenuItem value="by_language">
                        <Trans>By Language</Trans>
                      </MenuItem>
                      <MenuItem value="by_title">
                        <Trans>By Title</Trans>
                      </MenuItem>
                    </Select>
                  </FormControl>
                )}
              />

              {audioType === 'by_language' && (
                <AudioByLanguageFields index={index} />
              )}
              {audioType === 'by_title' && <AudioByTitleFields index={index} />}
            </Stack>
          </Box>

          <Box>
            <Typography variant="subtitle1" gutterBottom>
              <Trans>Subtitle Selection</Trans>
            </Typography>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              <Trans>
                Which subtitle track(s) to select when the condition holds
              </Trans>
            </Typography>
            <Stack spacing={2}>
              <Controller
                control={control}
                name={`${prefix}.subtitleAction.type`}
                render={({ field }) => (
                  <FormControl size="small" sx={{ maxWidth: 300 }}>
                    <InputLabel>
                      <Trans>Subtitle Strategy</Trans>
                    </InputLabel>
                    <Select {...field} label={t`Subtitle Strategy`}>
                      <MenuItem value="disable">
                        <Trans>Disabled</Trans>
                      </MenuItem>
                      <MenuItem value="default">
                        <Trans>Default</Trans>
                      </MenuItem>
                      <MenuItem value="by_language">
                        <Trans>By Language</Trans>
                      </MenuItem>
                    </Select>
                  </FormControl>
                )}
              />

              {subtitleType === 'by_language' && (
                <SubtitleByLanguageFields index={index} />
              )}
            </Stack>
          </Box>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

function AudioByLanguageFields({ index }: { index: number }) {
  const { control } = useFormContext<StreamSelectionProfileFormValues>();
  const prefix = `rules.${index}.audioAction` as const;

  return (
    <Stack spacing={2}>
      <Controller
        control={control}
        name={`${prefix}.languages`}
        rules={{
          validate: (v) =>
            !v || v.length === 0
              ? t`At least one language is required`
              : undefined,
        }}
        render={({ field, fieldState: { error } }) => (
          <LanguageAutocomplete
            values={field.value}
            showValues
            onRemove={({ iso6392 }) =>
              field.onChange((field.value ?? []).filter((v) => v !== iso6392))
            }
            onSelect={({ iso6392 }) => {
              field.onChange([...(field.value ?? []), iso6392]);
            }}
            onClear={() => field.onChange([])}
            allowMultiple
            helperText={
              error?.message ??
              t`Preferred languages in priority order. Type a code to add custom.`
            }
            textFieldProps={{
              size: 'small',
              error: !!error,
            }}
          />
          // <Autocomplete
          //   multiple
          //   freeSolo
          //   options={COMMON_LANGUAGES.map((l) => l.code)}
          //   getOptionLabel={(option) => {
          //     const lang = COMMON_LANGUAGES.find((l) => l.code === option);
          //     return lang ? `${lang.label} (${lang.code})` : option;
          //   }}
          //   value={field.value ?? []}
          //   onChange={(_, newValue) => field.onChange(newValue)}
          //   renderTags={(value, getTagProps) =>
          //     value.map((code, i) => {
          //       const lang = COMMON_LANGUAGES.find((l) => l.code === code);
          //       return (
          //         <Chip
          //           {...getTagProps({ index: i })}
          //           key={code}
          //           label={lang ? `${lang.label} (${lang.code})` : code}
          //           size="small"
          //         />
          //       );
          //     })
          //   }
          //   renderInput={(params) => (
          //     <TextField
          //       {...params}
          //       label={t`Languages`}
          //       size="small"
          //       error={!!error}
          //       helperText={
          //         error?.message ??
          //         t`Preferred languages in priority order. Type a code to add custom.`
          //       }
          //     />
          //   )}
          // />
        )}
      />
      <Controller
        control={control}
        name={`${prefix}.preferChannels`}
        render={({ field }) => (
          <FormControl size="small" sx={{ maxWidth: 300 }}>
            <InputLabel>
              <Trans>Prefer Channel Count</Trans>
            </InputLabel>
            <Select
              {...field}
              value={field.value ?? ''}
              label={t`Prefer Channel Count`}
            >
              <MenuItem value="">
                <Trans>No preference</Trans>
              </MenuItem>
              <MenuItem value="most">
                <Trans>Most channels (e.g. 7.1 surround)</Trans>
              </MenuItem>
              <MenuItem value="least">
                <Trans>Least channels (e.g. stereo)</Trans>
              </MenuItem>
            </Select>
          </FormControl>
        )}
      />
    </Stack>
  );
}

function AudioByTitleFields({ index }: { index: number }) {
  const { control } = useFormContext<StreamSelectionProfileFormValues>();

  return (
    <Controller
      control={control}
      name={`rules.${index}.audioAction.titleContains`}
      rules={{ required: t`Title filter is required` }}
      render={({ field, fieldState: { error } }) => (
        <TextField
          {...field}
          value={field.value ?? ''}
          label={t`Title Contains`}
          helperText={
            error?.message ??
            t`Match audio streams whose title contains this text (case-insensitive)`
          }
          error={!!error}
          size="small"
          placeholder="Commentary"
        />
      )}
    />
  );
}

function SubtitleByLanguageFields({ index }: { index: number }) {
  const { control } = useFormContext<StreamSelectionProfileFormValues>();
  const prefix = `rules.${index}.subtitleAction` as const;

  return (
    <Stack spacing={2}>
      <Controller
        control={control}
        name={`${prefix}.languages`}
        rules={{
          validate: (v) =>
            !v || v.length === 0
              ? t`At least one language is required`
              : undefined,
        }}
        render={({ field, fieldState: { error } }) => (
          <Autocomplete
            multiple
            freeSolo
            options={COMMON_LANGUAGES.map((l) => l.code)}
            getOptionLabel={(option) => {
              const lang = COMMON_LANGUAGES.find((l) => l.code === option);
              return lang ? `${lang.label} (${lang.code})` : option;
            }}
            value={field.value ?? []}
            onChange={(_, newValue) => field.onChange(newValue)}
            renderTags={(value, getTagProps) =>
              value.map((code, i) => {
                const lang = COMMON_LANGUAGES.find((l) => l.code === code);
                return (
                  <Chip
                    {...getTagProps({ index: i })}
                    key={code}
                    label={lang ? `${lang.label} (${lang.code})` : code}
                    size="small"
                  />
                );
              })
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label={t`Languages`}
                size="small"
                error={!!error}
                helperText={error?.message ?? t`Preferred subtitle languages`}
              />
            )}
          />
        )}
      />
      <Controller
        control={control}
        name={`${prefix}.filterType`}
        render={({ field }) => (
          <FormControl size="small" sx={{ maxWidth: 300 }}>
            <InputLabel>
              <Trans>Filter</Trans>
            </InputLabel>
            <Select {...field} value={field.value ?? 'any'} label={t`Filter`}>
              <MenuItem value="any">
                <Trans>Any</Trans>
              </MenuItem>
              <MenuItem value="forced">
                <Trans>Forced only</Trans>
              </MenuItem>
              <MenuItem value="default">
                <Trans>Default only</Trans>
              </MenuItem>
              <MenuItem value="none">
                <Trans>None (no filter)</Trans>
              </MenuItem>
            </Select>
          </FormControl>
        )}
      />
      <Stack direction="row" spacing={2}>
        <Controller
          control={control}
          name={`${prefix}.allowImageBased`}
          render={({ field }) => (
            <FormControlLabel
              control={
                <Switch
                  checked={field.value ?? true}
                  onChange={field.onChange}
                />
              }
              label={t`Allow image-based subtitles`}
            />
          )}
        />
        <Controller
          control={control}
          name={`${prefix}.allowExternal`}
          render={({ field }) => (
            <FormControlLabel
              control={
                <Switch
                  checked={field.value ?? true}
                  onChange={field.onChange}
                />
              }
              label={t`Allow external subtitles`}
            />
          )}
        />
      </Stack>
    </Stack>
  );
}
