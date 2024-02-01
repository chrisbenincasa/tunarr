import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import Box from '@mui/material/Box';
import useStore from '../../store/index.ts';
import Grid2 from '@mui/material/Unstable_Grid2/Grid2';

export function ChannelFlexConfig() {
  const channel = useStore((s) => s.channelEditor.currentEntity);

  return (
    channel && (
      <Box>
        <Grid2 container spacing={2}>
          <Grid2 xs={3}>
            <Box
              component="img"
              width="100%"
              src={
                channel.offline.picture ??
                'http://localhost:8000/images/generic-offline-screen.png'
              }
              sx={{ mr: 1 }}
            />
          </Grid2>
          <Grid2 xs={9}>
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
          </Grid2>
        </Grid2>
      </Box>
    )
  );
}
