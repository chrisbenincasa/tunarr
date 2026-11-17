import Breadcrumbs from '@/components/Breadcrumbs.tsx';
import { ChannelOptionsButton } from '@/components/channels/ChannelOptionsButton.tsx';
import { useChannelAndProgramming } from '@/hooks/useChannelLineup.ts';
import { Route } from '@/routes/channels_/$channelId/programming/index.tsx';
import { DeleteConfirmationDialog } from '@/components/DeleteConfirmationDialog.tsx';
import { getApiErrorMessage } from '@/helpers/apiError.ts';
import { useDeleteChannelSchedule } from '@/hooks/useDeleteChannelSchedule.ts';
import { Trans, useLingui } from '@lingui/react/macro';
import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';
import { useEffect, useState } from 'react';
import { RouterLink } from '../../components/base/RouterLink.tsx';
import { ChannelProgrammingConfig } from '../../components/channel_config/ChannelProgrammingConfig.tsx';
import UnsavedNavigationAlert from '../../components/settings/UnsavedNavigationAlert.tsx';
import { resetLineup } from '../../store/channelEditor/actions.ts';
import { useChannelEditor } from '../../store/selectors.ts';

export default function ChannelProgrammingPage() {
  const { channelId } = Route.useParams();
  const {
    data: { channel },
  } = useChannelAndProgramming(channelId);

  const {
    schedule,
    dirty: { programs: programsDirty },
  } = useChannelEditor();
  const { t } = useLingui();
  const snackbar = useSnackbar();
  const [confirmRemoveSchedule, setConfirmRemoveSchedule] = useState(false);
  const deleteSchedule = useDeleteChannelSchedule({
    onSuccess: () => {
      snackbar.enqueueSnackbar(t`Schedule removed`, { variant: 'success' });
    },
    onError: (error) => {
      const message = getApiErrorMessage(error) ?? error.message;
      snackbar.enqueueSnackbar(t`Error removing schedule. ${message}`, {
        variant: 'error',
      });
    },
  });

  // Force this page to load at the top
  // Fixes issue where some browsers maintain previous page scroll position
  // To do: find better solution
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div>
      <Breadcrumbs />
      <Stack direction="row" sx={{ mb: 2 }} alignItems="center">
        <Typography variant="h4" sx={{ flex: 1 }}>
          {channel.name}
        </Typography>
        <Box>
          <ChannelOptionsButton
            channel={channel}
            hideItems={['programming', 'duplicate', 'delete']}
          />
        </Box>
      </Stack>
      {schedule && (
        <Alert
          sx={{ mb: 2 }}
          severity="info"
          component={Paper}
          elevation={1}
          action={
            <Button
              color="inherit"
              size="small"
              disabled={deleteSchedule.isPending}
              onClick={() => setConfirmRemoveSchedule(true)}
            >
              <Trans>Remove schedule</Trans>
            </Button>
          }
        >
          <Trans>
            This channel is set up to use{' '}
            <RouterLink
              to={
                schedule.type === 'time'
                  ? '/channels/$channelId/programming/time-slot-editor'
                  : '/channels/$channelId/programming/slot-editor'
              }
              params={{ channelId }}
            >
              {schedule.type === 'time' ? 'Time ' : ' '}
              Slots
            </RouterLink>{' '}
            for programming. Any manual changes on this page will likely make
            this channel stop adhering to that schedule.
          </Trans>
        </Alert>
      )}
      <DeleteConfirmationDialog
        open={confirmRemoveSchedule}
        title={t`Remove schedule?`}
        body={t`This channel keeps its current programs but will no longer use its slot schedule. You can then edit the programs by hand on this page.`}
        onConfirm={() => deleteSchedule.mutate({ path: { id: channelId } })}
        onClose={() => setConfirmRemoveSchedule(false)}
      />
      <Paper sx={{ p: 2 }}>
        <ChannelProgrammingConfig />
        <UnsavedNavigationAlert
          isDirty={programsDirty}
          exceptTargetPaths={['/channels/$channelId/programming/add']}
          onProceed={() => resetLineup()}
        />
      </Paper>
    </div>
  );
}
