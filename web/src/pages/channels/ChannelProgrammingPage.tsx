import { useChannelAndProgramming } from '@/hooks/useChannelLineup.ts';
import Edit from '@mui/icons-material/Edit';
import {
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { isUndefined } from 'lodash-es';
import { useEffect } from 'react';
import { ChannelProgrammingConfig } from '../../components/channel_config/ChannelProgrammingConfig.tsx';
import UnsavedNavigationAlert from '../../components/settings/UnsavedNavigationAlert.tsx';
import { resetLineup } from '../../store/channelEditor/actions.ts';
import useStore from '../../store/index.ts';
import { Route } from '@/routes/channels_/$channelId/programming/index.tsx';
import { Link } from '@tanstack/react-router';
import Breadcrumbs from '@/components/Breadcrumbs.tsx';

export default function ChannelProgrammingPage() {
  const { channelId } = Route.useParams();
  const {
    data: { channel },
    isPending,
  } = useChannelAndProgramming(channelId);

  const programsDirty = useStore((s) => s.channelEditor.dirty.programs);

  // Force this page to load at the top
  // Fixes issue where some browsers maintain previous page scroll position
  // To do: find better solution
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return isUndefined(channel) || isPending ? (
    <div>
      <CircularProgress />
    </div>
  ) : (
    <div>
      <Breadcrumbs />
      <Stack direction="row">
        <Typography variant="h4" sx={{ mb: 2, flex: 1 }}>
          {channel.name}
        </Typography>
        <Box>
          <Button
            component={Link}
            to="../edit"
            variant="outlined"
            startIcon={<Edit />}
          >
            Edit
          </Button>
        </Box>
      </Stack>
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
