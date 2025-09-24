import { CopyAll } from '@mui/icons-material';
import { Box, Button } from '@mui/material';
import { useSuspenseQuery } from '@tanstack/react-query';
import { getApiProgramsByIdOptions } from '../generated/@tanstack/react-query.gen.ts';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard.ts';

type Props = {
  programId: string;
};

export const RawProgramDetails = ({ programId }: Props) => {
  const { data: result } = useSuspenseQuery({
    ...getApiProgramsByIdOptions({ path: { id: programId } }),
    staleTime: 60_000,
  });
  const copy = useCopyToClipboard();

  return (
    <Box sx={{ maxHeight: '70vh' }}>
      <Button
        onClick={() =>
          copy(JSON.stringify(result, undefined, 2)).catch((e) =>
            console.error(e),
          )
        }
        startIcon={<CopyAll />}
      >
        Copy to Clipboard
      </Button>
      <pre>{JSON.stringify(result, undefined, 2)}</pre>
    </Box>
  );
};
