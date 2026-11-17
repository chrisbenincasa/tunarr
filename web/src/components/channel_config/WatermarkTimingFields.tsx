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
import { useEffect, useRef, useState } from 'react';
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
  errorText?: string;
};

// Keeps the typed text so partial input like "1." survives. The text is
// re-seeded only when the form value changes from outside, such as after a
// form reset. Comparing against the last value this field wrote, rather than
// round-tripping the text, keeps fractional stored values from re-seeding on
// every render.

function LimitMinutesField({
  seconds,
  onChange,
  onBlur,
  label,
  helperText,
  errorText,
}: LimitMinutesFieldProps) {
  const [text, setText] = useState(() => String(secondsToMinutes(seconds)));
  const [syncedSeconds, setSyncedSeconds] = useState(seconds);
  if (!Object.is(seconds, syncedSeconds)) {
    setSyncedSeconds(seconds);
    setText(String(secondsToMinutes(seconds)));
  }

  return (
    <TextField
      fullWidth
      label={label}
      error={!!errorText}
      helperText={errorText ?? helperText}
      value={text}
      slotProps={{ htmlInput: { inputMode: 'decimal' } }}
      onChange={(e) => {
        const next = minutesToSeconds(e.target.value);
        setText(e.target.value);
        setSyncedSeconds(next);
        onChange(next);
      }}
      onBlur={onBlur}
    />
  );
}

// Fade cycle and time limit are separate groups because the time limit
// applies on top of the fade cycle, not to each fade.
export function WatermarkTimingFields() {
  const { t } = useLingui();
  const { control, watch, getValues, setValue } = useChannelFormContext();
  const fadePeriod = watch('watermark.fadeConfig.0.periodMins');
  const duration = watch('watermark.duration');

  // The form keeps field values after unmount but drops their validation
  // rules. Restore the last valid limit on unmount so invalid text can't reach
  // the save request once the field is hidden.

  const lastValidDuration = useRef(duration);
  useEffect(() => {
    if (Number.isFinite(duration)) {
      lastValidDuration.current = duration;
    }
  }, [duration]);
  useEffect(
    () => () => {
      if (!Number.isFinite(getValues('watermark.duration'))) {
        setValue('watermark.duration', lastValidDuration.current ?? 0);
      }
    },
    [getValues, setValue],
  );

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
            helperText: t`The watermark fades in, stays for this many minutes, then hides for the same length. Set to 0 to keep it on screen without fading.`,
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
          rules={{
            validate: (value) =>
              Number.isFinite(value) ||
              t`Enter a number of minutes, 0 or more.`,
          }}
          render={({ field, fieldState }) => (
            <LimitMinutesField
              seconds={field.value ?? 0}
              onChange={field.onChange}
              onBlur={field.onBlur}
              label={t`Hide Watermark After (minutes)`}
              helperText={t`Counted from the start of each program. If a stream starts partway through a program, it counts from that point. Set to 0 for no limit.`}
              errorText={fieldState.error?.message}
            />
          )}
        />
      </Grid>
    </>
  );
}
