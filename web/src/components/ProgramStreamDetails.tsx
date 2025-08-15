import { CopyAll } from '@mui/icons-material';
import { Box, Button } from '@mui/material';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard.ts';
import { useTunarrApi } from '../hooks/useTunarrApi.ts';

type Props = {
  programId: string;
};

export const ProgramStreamDetails = ({ programId }: Props) => {
  const apiClient = useTunarrApi();
  const { data: result } = useSuspenseQuery({
    queryKey: ['programs', programId, 'stream_details'],
    queryFn: () =>
      apiClient.getProgramStreamDetails({ params: { id: programId } }),
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
