import { Grid } from '@mui/material';
import type { DropdownOption } from '../../../helpers/DropdownOption';
import { useTypedAppFormContext } from '../../../hooks/form.ts';
import type { BaseTranscodeConfigProps } from './BaseTranscodeConfigProps.ts';
import { useBaseTranscodeConfigFormOptions } from './useTranscodeConfigFormOptions.ts';

const supportedErrorScreens = [
  {
    value: 'pic',
    description: 'Default Generic Error Image',
  },
  { value: 'blank', description: 'Blank Screen' },
  { value: 'static', description: 'Static' },
  {
    value: 'testsrc',
    description: 'Test Pattern (color bars + timer)',
  },
  {
    value: 'text',
    description: 'Detailed error (requires ffmpeg with drawtext)',
  },
  {
    value: 'kill',
    description: 'Stop stream, show errors in logs',
  },
] satisfies DropdownOption<string>[];

const supportedErrorAudio = [
  { value: 'whitenoise', description: 'White Noise' },
  { value: 'sine', description: 'Beep' },
  { value: 'silent', description: 'No Audio' },
] satisfies DropdownOption<string>[];

export const TranscodeConfigErrorOptions = ({
  initialConfig,
}: BaseTranscodeConfigProps) => {
  const formOpts = useBaseTranscodeConfigFormOptions(initialConfig);
  const form = useTypedAppFormContext({ ...formOpts });
  return (
    <Grid container spacing={2}>
      <Grid size={{ sm: 12, md: 6 }}>
        <form.AppField
          name="errorScreen"
          children={(field) => (
            <field.BasicSelectInput
              formControlProps={{ sx: { mt: 2 }, fullWidth: true }}
              options={supportedErrorScreens}
              selectProps={{ label: 'Error Screen' }}
              helperText="If there are issues playing a video, Tunarr will try to use an error
            screen as a placeholder while retrying loading the video every 60
            seconds."
            />
          )}
        />
      </Grid>
      <Grid size={{ sm: 12, md: 6 }}>
        <form.AppField
          name="errorScreenAudio"
          children={(field) => (
            <field.BasicSelectInput
              formControlProps={{ sx: { mt: 2 }, fullWidth: true }}
              options={supportedErrorAudio}
              selectProps={{ label: 'Error Audio', fullWidth: true }}
            />
          )}
        />
      </Grid>
    </Grid>
  );
};
