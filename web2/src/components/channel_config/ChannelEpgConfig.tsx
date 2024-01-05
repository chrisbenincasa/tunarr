import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import useStore from '../../store/index.ts';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';

export default function ChannelEpgConfig() {
  const channel = useStore((s) => s.channelEditor.currentChannel);

  return (
    <Box>
      <FormGroup>
        <FormControl>
          <FormControlLabel
            control={
              <Checkbox
                defaultChecked={false}
                value={channel?.stealth ?? false}
              />
            }
            label="Stealth Mode"
          />
          <FormHelperText>
            This will hide the channel from TV guides, spoofed HDHR, m3u
            playlist, etc. The channel can still be streamed directly or be used
            as a redirect target.
          </FormHelperText>
        </FormControl>
        <TextField
          helperText="This is the name of the fake program that will appear in the TV guide when there are no programs to display in that time slot guide. E.g when a large Flex block is scheduled.
"
          label="Placeholder Program Title"
          value={channel?.guideFlexPlaceholder ?? ''}
          margin="normal"
        />
        <TextField
          label="Min. Visible in Guide Duration Program (seconds)"
          helperText='Programs shorter than this value will be treated the same as Flex time. Meaning that the TV Guide will try to meld them with the previous program or display the block of programs as the "place holder program" if they make a large continuous group. Use 0 to disable this feature or use a large value to make the channel report only the placeholder program and not the real programming.
          '
          value={channel?.guideMinimumDurationSeconds ?? 300}
          margin="normal"
        />
      </FormGroup>
    </Box>
  );
}
