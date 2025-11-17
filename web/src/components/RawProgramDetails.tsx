import { CopyAll } from '@mui/icons-material';
import { Button, Stack, TextField } from '@mui/material';
import type { ProgramGrouping, TerminalProgram } from '@tunarr/types';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard.ts';

type Props = {
  program: TerminalProgram | ProgramGrouping;
};

export const RawProgramDetails = ({ program }: Props) => {
  const copy = useCopyToClipboard();

  return (
    <Stack sx={{ maxHeight: '70vh' }} spacing={2}>
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
        maxRows={15}
        fullWidth
        defaultValue={JSON.stringify(program, undefined, 2)}
        disabled
        slotProps={{
          input: {
            sx: {
              fontFamily: 'monospace',
            },
          },
        }}
      />
    </Stack>
  );
};
