import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import FormHelperText from '@mui/material/FormHelperText';
import TextField from '@mui/material/TextField';
import type { Channel } from '@tunarr/types';
import { Controller, useFormContext } from 'react-hook-form';
import { NumericFormController } from '../util/TypedController.tsx';

export default function ChannelEpgConfig() {
  const { control } = useFormContext<Channel>();

  return (
    <>
      <Box>
        <FormGroup>
          <Controller
            name="stealth"
            control={control}
            render={({ field }) => (
              <FormControl>
                <FormControlLabel
                  control={<Checkbox {...field} checked={field.value} />}
                  label="Stealth Mode"
                />
                <FormHelperText>
                  "Stealth" channels are hidden from TV guides, spoofed HDHR,
                  m3u playlist, etc. The channel can still be streamed directly
                  or be used as a redirect target.
                </FormHelperText>
              </FormControl>
            )}
          />

          <Controller
            control={control}
            name="guideFlexTitle"
            render={({ field }) => (
              <TextField
                helperText="This is the name of the fake program that will appear in the TV guide when there are no programs to display in that time slot guide, e.g when a large Flex block is scheduled."
                label="Placeholder Program Title"
                margin="normal"
                {...field}
                value={field.value ?? ''}
              />
            )}
          />

          <NumericFormController
            control={control}
            name="guideMinimumDuration"
            render={({ field, formState: { errors } }) => (
              <TextField
                label="Min. Visible in Guide Duration Program (seconds)"
                helperText={`Programs shorter than this value will be treated the same as Flex time. Meaning that the TV Guide will try to meld them with the previous program or display the block of programs as the "place holder program" if they make a large continuous group. Use 0 to disable this feature or use a large value to make the channel report only the placeholder program and not the real programming.\n${
                  errors?.guideMinimumDuration?.message ?? ''
                }`}
                margin="normal"
                {...field}
              />
            )}
          />
        </FormGroup>
      </Box>
    </>
  );
}
