import { CopyAll } from '@mui/icons-material';
import { Box, Button, TextField } from '@mui/material';
import { useSuspenseQuery } from '@tanstack/react-query';
import { getApiProgramsByIdStreamDetailsOptions } from '../generated/@tanstack/react-query.gen.ts';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard.ts';

type Props = {
  programId: string;
};

export const ProgramStreamDetails = ({ programId }: Props) => {
  const { data: result } = useSuspenseQuery({
    ...getApiProgramsByIdStreamDetailsOptions({ path: { id: programId } }),
    staleTime: 60_000,
  });
  const copy = useCopyToClipboard();

  return (
    <Box sx={{ maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
      <Button
        onClick={() =>
          copy(JSON.stringify(result, undefined, 2)).catch((e) =>
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
        label="Stream JSON"
        multiline
        rows={8}
        fullWidth
        defaultValue={JSON.stringify(result, undefined, 2)}
        disabled
        // sx={{backgroundColor: }}
      />
    </Box>
  );
};
