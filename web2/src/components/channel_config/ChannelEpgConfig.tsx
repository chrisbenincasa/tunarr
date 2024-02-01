import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import FormHelperText from '@mui/material/FormHelperText';
import TextField from '@mui/material/TextField';
import { Channel } from '@tunarr/types';
import { Controller, useFormContext } from 'react-hook-form';

export default function ChannelEpgConfig() {
  const { control } = useFormContext<Channel>();

  return (
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
                playlist, etc. The channel can still be streamed directly or be
                used as a redirect target.
              </FormHelperText>
            </FormControl>
          )}
        />

        <Controller
          control={control}
          name="guideFlexPlaceholder"
          render={({ field }) => (
            <TextField
              helperText="This is the name of the fake program that will appear in the TV guide when there are no programs to display in that time slot guide. E.g when a large Flex block is scheduled.
"
              label="Placeholder Program Title"
              margin="normal"
              {...field}
            />
          )}
        />

        <Controller
          control={control}
          name="guideMinimumDurationSeconds"
          render={({ field }) => (
            <TextField
              label="Min. Visible in Guide Duration Program (seconds)"
              helperText='Programs shorter than this value will be treated the same as Flex time. Meaning that the TV Guide will try to meld them with the previous program or display the block of programs as the "place holder program" if they make a large continuous group. Use 0 to disable this feature or use a large value to make the channel report only the placeholder program and not the real programming.
          '
              margin="normal"
              {...field}
            />
          )}
        />
      </FormGroup>
    </Box>
  );
}
