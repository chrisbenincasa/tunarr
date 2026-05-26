import { Trans, useLingui } from '@lingui/react/macro';
import { CopyAll } from '@mui/icons-material';
import { Button, Stack, TextField } from '@mui/material';
import { useSuspenseQuery } from '@tanstack/react-query';
import { getProgramStreamDetailsOptions } from '../generated/@tanstack/react-query.gen.ts';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard.ts';

type Props = {
  programId: string;
};

export const ProgramStreamDetails = ({ programId }: Props) => {
  const { t } = useLingui();
  const { data: result } = useSuspenseQuery({
    ...getProgramStreamDetailsOptions({ path: { id: programId } }),
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
        <Trans>Copy to Clipboard</Trans>
      </Button>
      <TextField
        label={t`Stream JSON`}
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
