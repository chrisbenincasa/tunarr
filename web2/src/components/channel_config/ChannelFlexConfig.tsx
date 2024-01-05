import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import Box from '@mui/material/Box';
import useStore from '../../store/index.ts';

export function ChannelFlexConfig() {
  const channel = useStore((s) => s.channelEditor.currentChannel);
  return (
    <Box>
      <Box>
        <FormControl fullWidth margin="normal">
          <InputLabel>Fallback Mode</InputLabel>
          <Select
            fullWidth
            value={channel?.offline.mode ?? 'pic'}
            label="Fallback Mode"
          >
            <MenuItem value={'pic'}>Picture</MenuItem>
            <MenuItem value={'clip'}>Library Clip</MenuItem>
          </Select>
        </FormControl>
      </Box>
    </Box>
  );
}
