import { Close, CopyAll } from '@mui/icons-material';
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Skeleton,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { result } from 'lodash-es';
import { getApiProgramsByIdOptions } from '../../generated/@tanstack/react-query.gen.ts';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard.ts';

type Props = {
  open: boolean;
  onClose: () => void;
  programId: string;
};

export const NewProgramDetailsDialog = ({
  onClose,
  open,
  programId,
}: Props) => {
  const theme = useTheme();
  const smallViewport = useMediaQuery(theme.breakpoints.down('sm'));
  const copy = useCopyToClipboard();

  const query = useQuery({
    ...getApiProgramsByIdOptions({
      path: {
        id: programId,
      },
    }),
    enabled: open,
  });

  return (
    <Dialog
      open={open}
      fullScreen={smallViewport}
      maxWidth="md"
      fullWidth
      onClose={() => onClose()}
    >
      {query.isLoading ? (
        <Skeleton>
          <DialogTitle />
        </Skeleton>
      ) : (
        <DialogTitle
          variant="h4"
          sx={{ display: 'flex', alignItems: 'center' }}
        >
          <Box sx={{ flex: 1 }}>{query.data?.title} </Box>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => onClose()}
            aria-label="close"
            // sx={{ position: 'absolute', top: 10, right: 10 }}
            size="large"
          >
            <Close />
          </IconButton>
        </DialogTitle>
      )}

      <DialogContent>
        {/* <ProgramStreamDetails programId={item.uuid} /> */}
        {query.isLoading && <LinearProgress />}
        <Box sx={{ maxHeight: '70vh' }}>
          {query.data && (
            <>
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
              <pre>{JSON.stringify(query.data, undefined, 4)}</pre>
            </>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
};
