import { CopyAll } from '@mui/icons-material';
import { Button, Stack, TextField } from '@mui/material';
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
    <Stack sx={{ maxHeight: '70vh' }} spacing={2}>
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
        maxRows={15}
        fullWidth
        defaultValue={JSON.stringify(result, undefined, 2)}
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
