import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import FormHelperText from '@mui/material/FormHelperText';
import TextField from '@mui/material/TextField';
import { Channel } from '@tunarr/types';
import { isInteger, omit } from 'lodash-es';
import { Controller, useFormContext } from 'react-hook-form';
import ChannelEditActions from './ChannelEditActions.tsx';

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
                  control={<Checkbox {...field} />}
                  label="Stealth Mode"
                />
                <FormHelperText>
                  This will hide the channel from TV guides, spoofed HDHR, m3u
                  playlist, etc. The channel can still be streamed directly or
                  be used as a redirect target.
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

          <Controller
            control={control}
            name="guideMinimumDuration"
            rules={{
              validate: (v) => (isInteger(v) ? true : 'Value must be a number'),
            }}
            render={({ field, formState: { errors } }) => (
              <TextField
                label="Min. Visible in Guide Duration Program (seconds)"
                helperText={`Programs shorter than this value will be treated the same as Flex time. Meaning that the TV Guide will try to meld them with the previous program or display the block of programs as the "place holder program" if they make a large continuous group. Use 0 to disable this feature or use a large value to make the channel report only the placeholder program and not the real programming.\n${
                  errors?.guideMinimumDuration?.message ?? ''
                }`}
                margin="normal"
                {...omit(field, 'onChange')}
                onChange={(e) => field.onChange(parseInt(e.target.value))}
              />
            )}
          />
        </FormGroup>
      </Box>
      <ChannelEditActions />
    </>
  );
}
