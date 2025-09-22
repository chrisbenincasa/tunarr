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
import type { ProgramLike } from '@tunarr/types';
import { isStructuralItemType, isTerminalItemType } from '@tunarr/types';
import {
  getApiProgramGroupingsByIdOptions,
  getApiProgramsByIdOptions,
} from '../../generated/@tanstack/react-query.gen.ts';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard.ts';

type Props = {
  open: boolean;
  onClose: () => void;
  programId: string;
  programType: ProgramLike['type'];
};

export const NewProgramDetailsDialog = ({
  onClose,
  open,
  programId,
  programType,
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
    enabled: open && isTerminalItemType(programType),
  });

  const parentQuery = useQuery({
    ...getApiProgramGroupingsByIdOptions({
      path: {
        id: programId,
      },
    }),
    enabled:
      open &&
      !isTerminalItemType(programType) &&
      !isStructuralItemType(programType),
  });

  const isLoading = parentQuery.isLoading || query.isLoading;

  return (
    <Dialog
      open={open}
      fullScreen={smallViewport}
      maxWidth="md"
      fullWidth
      onClose={() => onClose()}
    >
      {isLoading ? (
        <Skeleton>
          <DialogTitle />
        </Skeleton>
      ) : (
        <DialogTitle
          variant="h4"
          sx={{ display: 'flex', alignItems: 'center' }}
        >
          <Box sx={{ flex: 1 }}>
            {query.data?.title ?? parentQuery.data?.title}{' '}
          </Box>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => onClose()}
            aria-label="close"
            size="large"
          >
            <Close />
          </IconButton>
        </DialogTitle>
      )}

      <DialogContent>
        {/* <ProgramStreamDetails programId={item.uuid} /> */}
        {isLoading && <LinearProgress />}
        <Box sx={{ maxHeight: '70vh' }}>
          {(query.data || parentQuery.data) && (
            <>
              <Button
                onClick={() =>
                  copy(
                    JSON.stringify(
                      query.data ?? parentQuery.data,
                      undefined,
                      2,
                    ),
                  ).catch((e) => console.error(e))
                }
                startIcon={<CopyAll />}
              >
                Copy to Clipboard
              </Button>
              <pre>
                {JSON.stringify(query.data ?? parentQuery.data, undefined, 4)}
              </pre>
            </>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
};
