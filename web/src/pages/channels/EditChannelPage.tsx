import type { EditChannelTabs } from '@/components/channel_config/EditChannelTabPanel.tsx';
import { ChannelOptionsButton } from '@/components/channels/ChannelOptionsButton.tsx';
import { useChannelSuspense } from '@/hooks/useChannels.ts';
import { Route } from '@/routes/channels_/$channelId/edit/index.tsx';
import { Box, Stack } from '@mui/material';
import Typography from '@mui/material/Typography';
import Breadcrumbs from '../../components/Breadcrumbs.tsx';
import { EditChannelForm } from '../../components/channel_config/EditChannelForm.tsx';

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
            <ChannelOptionsButton
              channel={channel}
              hideItems={['edit', 'duplicate', 'delete']}
            />
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
