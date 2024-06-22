import { EditChannelForm } from '@/components/channel_config/EditChannelForm';
import { Route } from '@/routes/channels/new';
import { Typography } from '@mui/material';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import { useState } from 'react';
import {
  ChannelEditContext,
  ChannelEditContextState,
} from './EditChannelContext';

export function NewChannelPage() {
  // The route code creates the "working channel"
  const workingChannel = Route.useLoaderData();
  const [channelEditorState, setChannelEditorState] =
    useState<ChannelEditContextState>({
      currentTabValid: true,
      isNewChannel: true,
    });

  return (
    <>
      <Breadcrumbs />
      {workingChannel && (
        <div>
          <Typography variant="h4" sx={{ mb: 2 }}>
            New Channel
          </Typography>
          <ChannelEditContext.Provider
            value={{ channelEditorState, setChannelEditorState }}
          >
            <EditChannelForm channel={workingChannel} isNew={true} />
          </ChannelEditContext.Provider>
        </div>
      )}
    </>
  );
}
