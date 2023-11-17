import { Box, Button, Dialog } from '@mui/material';
import { useState } from 'react';
import ProgrammingSelector from './ProgrammingSelector.tsx';

export function ChannelProgrammingConfig() {
  const [programmingModalOpen, setProgrammingModalOpen] = useState(false);

  return (
    <Box>
      <Button variant="contained" onClick={() => setProgrammingModalOpen(true)}>
        Add
      </Button>
      <Dialog
        open={programmingModalOpen}
        onClose={() => setProgrammingModalOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <ProgrammingSelector />
      </Dialog>
    </Box>
  );
}
