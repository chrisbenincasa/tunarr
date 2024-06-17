import { CircularProgress, Paper, Typography } from '@mui/material';
import { isUndefined } from 'lodash-es';
import { useEffect } from 'react';
import Breadcrumbs from '../../components/Breadcrumbs.tsx';
import { ChannelProgrammingConfig } from '../../components/channel_config/ChannelProgrammingConfig.tsx';
import UnsavedNavigationAlert from '../../components/settings/UnsavedNavigationAlert.tsx';
import { usePreloadedChannelEdit } from '../../hooks/usePreloadedChannel.ts';
import { resetLineup } from '../../store/channelEditor/actions.ts';
import useStore from '../../store/index.ts';

export default function ChannelProgrammingPage() {
  const { currentEntity: channel } = usePreloadedChannelEdit();

  const programsDirty = useStore((s) => s.channelEditor.dirty.programs);

  // Force this page to load at the top
  // Fixes issue where some browsers maintain previous page scroll position
  // To do: find better solution
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return isUndefined(channel) ? (
    <div>
      <CircularProgress />
    </div>
  ) : (
    <div>
      <Breadcrumbs />
      <Typography variant="h4" sx={{ mb: 2 }}>
        {channel.name}
      </Typography>
      <Paper sx={{ p: 2 }}>
        <ChannelProgrammingConfig />
        <UnsavedNavigationAlert
          isDirty={programsDirty}
          onProceed={() => resetLineup()}
        />
      </Paper>
    </div>
  );
}
