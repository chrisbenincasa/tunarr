import { EditChannelTabs } from '@/components/channel_config/EditChannelTabPanel.tsx';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import Breadcrumbs from '../../components/Breadcrumbs.tsx';
import { EditChannelForm } from '../../components/channel_config/EditChannelForm.tsx';
import useStore from '../../store/index.ts';
import {
  ChannelEditContext,
  ChannelEditContextState,
} from './EditChannelContext.ts';
import { Route } from '@/routes/channels_/$channelId/edit/index.tsx';
import { useChannelSuspense } from '@/hooks/useChannels.ts';

type Props = {
  initialTab?: EditChannelTabs;
};

export default function EditChannelPage({ initialTab }: Props) {
  const { channelId } = Route.useParams();
  const { data: channel } = useChannelSuspense(channelId);
  const { currentEntity: workingChannel } = useStore((s) => s.channelEditor);
  const theme = useTheme();

  const [channelEditorState, setChannelEditorState] =
    useState<ChannelEditContextState>({
      currentTabValid: true,
      isNewChannel: false,
    });

  return (
    <>
      <Breadcrumbs />
      {workingChannel && (
        <div>
          <Typography variant="h4" sx={{ mb: 2 }}>
            {channel.name}
          </Typography>
          <ChannelEditContext.Provider
            value={{ channelEditorState, setChannelEditorState }}
          >
            <EditChannelForm
              channel={channel}
              isNew={false}
              initialTab={initialTab}
            />
          </ChannelEditContext.Provider>
        </div>
      )}
    </>
  );
}
