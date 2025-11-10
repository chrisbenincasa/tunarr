import { CopyAll } from '@mui/icons-material';
import { Box, Button, TextField } from '@mui/material';
import type { ProgramGrouping, TerminalProgram } from '@tunarr/types';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard.ts';

type Props = {
  program: TerminalProgram | ProgramGrouping;
};

export const RawProgramDetails = ({ program }: Props) => {
  const copy = useCopyToClipboard();

  return (
    <Box sx={{ maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
      <Button
        onClick={() =>
          copy(JSON.stringify(program, undefined, 2)).catch((e) =>
            console.error(e),
          )
        }
        startIcon={<CopyAll />}
        variant="contained"
        sx={{ alignSelf: 'flex-end' }}
      >
        Copy to Clipboard
      </Button>
      <TextField
        label="Program JSON"
        multiline
        rows={8}
        fullWidth
        defaultValue={JSON.stringify(program, undefined, 2)}
        disabled
      />
    </Box>
  );
};
