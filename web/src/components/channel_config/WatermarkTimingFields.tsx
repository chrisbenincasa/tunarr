import { Trans, useLingui } from '@lingui/react/macro';
import {
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { Controller } from 'react-hook-form';
import { useChannelFormContext } from '../../hooks/useChannelFormContext.ts';
import {
  CheckboxFormController,
  NumericFormControllerText,
} from '../util/TypedController.tsx';
import { minutesToSeconds, secondsToMinutes } from './watermarkTimeLimit.ts';

type LimitMinutesFieldProps = {
  seconds: number;
  onChange: (seconds: number) => void;
  onBlur: () => void;
  label: string;
  helperText: string;
  invalidText: string;
};

// Keeps the typed text so partial input like "1." survives. The text is
// re-seeded only when it no longer matches the form value, such as after a
// form reset.

function LimitMinutesField({
  seconds,
  onChange,
  onBlur,
  label,
  helperText,
  invalidText,
}: LimitMinutesFieldProps) {
  const [text, setText] = useState(() => String(secondsToMinutes(seconds)));
  if (minutesToSeconds(text) !== seconds) {
    setText(String(secondsToMinutes(seconds)));
  }
  const invalid = text.trim() !== '' && !(Number(text) >= 0);

  return (
    <TextField
      fullWidth
      label={label}
      error={invalid}
      helperText={invalid ? invalidText : helperText}
      value={text}
      slotProps={{ htmlInput: { inputMode: 'decimal' } }}
      onChange={(e) => {
        setText(e.target.value);
        onChange(minutesToSeconds(e.target.value));
      }}
      onBlur={onBlur}
    />
  );
}

// Fade cycle and time limit are separate groups because the time limit
// applies on top of the fade cycle, not to each fade.
export function WatermarkTimingFields() {
  const { t } = useLingui();
  const { control, watch } = useChannelFormContext();
  const fadePeriod = watch('watermark.fadeConfig.0.periodMins');

  return (
    <>
      <Grid size={{ xs: 12 }}>
        <Divider />
      </Grid>
      <Grid size={{ xs: 12 }}>
        <Typography variant="subtitle1" component="h6">
          <Trans>Fade In and Out</Trans>
        </Typography>
        <Typography variant="body2" color="text.secondary">
          <Trans>
            Repeatedly fades the watermark in and out while a program plays.
          </Trans>
        </Typography>
      </Grid>
      <Grid size={{ xs: 12, lg: 6 }}>
        <NumericFormControllerText
          control={control}
          name="watermark.fadeConfig.0.periodMins"
          rules={{ min: 0 }}
          TextFieldProps={{
            label: t`Fade Period (mins)`,
            fullWidth: true,
            helperText: t`The watermark fades in, stays for this many minutes, then fades out for the same length. Set to 0 to keep it on screen without fading.`,
          }}
        />
      </Grid>
      {(fadePeriod ?? 0) > 0 && (
        <Grid size={{ xs: 12, lg: 6 }}>
          <FormControl fullWidth>
            <FormControlLabel
              control={
                <CheckboxFormController
                  control={control}
                  name="watermark.fadeConfig.0.leadingEdge"
                />
              }
              label={t`Display Watermark on Leading Edge`}
            />
            <FormHelperText>
              <Trans>
                When enabled, intermittent watermarks fade in immediately when a
                stream is initialized. When disabled, the first watermark
                fade-in occurs after a full period.
              </Trans>
            </FormHelperText>
          </FormControl>
        </Grid>
      )}
      <Grid size={{ xs: 12 }}>
        <Divider />
      </Grid>
      <Grid size={{ xs: 12 }}>
        <Typography variant="subtitle1" component="h6">
          <Trans>Time Limit</Trans>
        </Typography>
        <Typography variant="body2" color="text.secondary">
          <Trans>
            Hides the watermark for the rest of each program once the limit is
            reached. This overrides the fade settings above.
          </Trans>
        </Typography>
      </Grid>
      <Grid size={{ xs: 12, lg: 6 }}>
        <Controller
          control={control}
          name="watermark.duration"
          render={({ field }) => (
            <LimitMinutesField
              seconds={field.value ?? 0}
              onChange={field.onChange}
              onBlur={field.onBlur}
              label={t`Hide Watermark After (minutes)`}
              helperText={t`Counted from the start of each program. Set to 0 for no limit.`}
              invalidText={t`Enter a number of minutes, 0 or more.`}
            />
          )}
        />
      </Grid>
    </>
  );
}
