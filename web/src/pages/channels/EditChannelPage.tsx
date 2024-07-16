import { EditChannelTabs } from '@/components/channel_config/EditChannelTabPanel.tsx';
import Typography from '@mui/material/Typography';
import Breadcrumbs from '../../components/Breadcrumbs.tsx';
import { EditChannelForm } from '../../components/channel_config/EditChannelForm.tsx';
import { Route } from '@/routes/channels_/$channelId/edit/index.tsx';
import { useChannelSuspense } from '@/hooks/useChannels.ts';
import Edit from '@mui/icons-material/Edit';
import { Link } from '@tanstack/react-router';
import { Stack, Box, Button } from '@mui/material';

type Props = {
  initialTab?: EditChannelTabs;
};

export default function EditChannelPage({ initialTab }: Props) {
  const { channelId } = Route.useParams();
  const { data: channel } = useChannelSuspense(channelId);

  return (
    <>
      <Breadcrumbs />
      <div>
        <Stack direction="row">
          <Typography variant="h4" sx={{ mb: 2, flex: 1 }}>
            {channel.name}
          </Typography>
          <Box>
            <Button
              component={Link}
              to="../programming"
              variant="outlined"
              startIcon={<Edit />}
            >
              Programming
            </Button>
          </Box>
        </Stack>
        <EditChannelForm
          channel={channel}
          isNew={false}
          initialTab={initialTab}
        />
      </div>
    </>
  );
}
