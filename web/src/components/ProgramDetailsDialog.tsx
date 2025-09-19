import { ProgramDebugDetailsMenu } from '@/dev/ProgramDebugDetailsMenu.tsx';
import { Close as CloseIcon } from '@mui/icons-material';
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Tab,
  Tabs,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { forProgramType } from '@tunarr/shared/util';
import type { ChannelProgram, TupleToUnion } from '@tunarr/types';
import type { Dayjs } from 'dayjs';
import { find, isUndefined, merge } from 'lodash-es';
import { Suspense, useCallback, useMemo, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import type { DeepRequired } from 'ts-essentials';
import { isNonEmptyString } from '../helpers/util';
import { ProgramMetadataDialogContent } from './ProgramMetadataDialogContent.tsx';
import { ProgramStreamDetails } from './ProgramStreamDetails.tsx';
import { TabPanel } from './TabPanel.tsx';

const Panels = ['metadata', 'stream_details'] as const;
type Panels = TupleToUnion<typeof Panels>;
type PanelVisibility = {
  [K in Panels]?: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  program: ChannelProgram | undefined;
  start?: Dayjs;
  stop?: Dayjs;
  panelVisibility?: PanelVisibility;
};

const formattedTitle = forProgramType({
  content: (p) => p.grandparent?.title ?? p.title,
  custom: (p) =>
    p.program?.grandparent?.title ?? p.program?.title ?? 'Custom Program',
  filler: (p) =>
    p.program?.grandparent?.title ?? p.program?.title ?? 'Filler Program',
  redirect: (p) => `Redirect to Channel ${p.channel}`,
  flex: 'Flex',
});

const DefaultPanelVisibility: DeepRequired<PanelVisibility> = {
  metadata: true,
  stream_details: true,
};

export default function ProgramDetailsDialog({
  open,
  onClose,
  start,
  stop,
  program,
  panelVisibility = DefaultPanelVisibility,
}: Props) {
  const visibility = useMemo(
    () => merge(DefaultPanelVisibility, panelVisibility),
    [panelVisibility],
  );
  const theme = useTheme();
  const smallViewport = useMediaQuery(theme.breakpoints.down('sm'));
  const defaultPanel = (find(Object.entries(visibility), (v) => !!v)?.[0] ??
    'metadata') as Panels;
  const [tab, setTab] = useState<Panels>(defaultPanel);

  const handleClose = useCallback(() => {
    setTab(defaultPanel);
    onClose();
  }, [defaultPanel, onClose]);

  return (
    program && (
      <Dialog
        open={open && !isUndefined(program)}
        onClose={handleClose}
        fullScreen={smallViewport}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle
          variant="h4"
          sx={{ display: 'flex', alignItems: 'center' }}
        >
          <Box sx={{ flex: 1 }}>{formattedTitle(program)} </Box>
          <ProgramDebugDetailsMenu program={program} />
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => handleClose()}
            aria-label="close"
            // sx={{ position: 'absolute', top: 10, right: 10 }}
            size="large"
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Tabs value={tab} onChange={(_, v) => setTab(v as Panels)}>
            {visibility.metadata && <Tab value={'metadata'} label="Overview" />}
            {visibility.stream_details && (
              <Tab
                value="stream_details"
                label="Stream Info"
                disabled={
                  program.type === 'redirect' || program.type === 'flex'
                }
              />
            )}
          </Tabs>
          <TabPanel index={'metadata'} value={tab}>
            <ProgramMetadataDialogContent
              program={program}
              start={start}
              stop={stop}
            />
          </TabPanel>
          <TabPanel index={'stream_details'} value={tab}>
            {program.type === 'content' && isNonEmptyString(program.id) ? (
              <ErrorBoundary
                fallback={
                  <>Failed to load stream details! Check logs for details</>
                }
              >
                <Suspense fallback={<LinearProgress />}>
                  <ProgramStreamDetails programId={program.id} />
                </Suspense>
              </ErrorBoundary>
            ) : null}
          </TabPanel>
        </DialogContent>
      </Dialog>
    )
  );
}
