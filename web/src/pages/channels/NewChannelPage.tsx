import { EditChannelForm } from '@/components/channel_config/EditChannelForm';
import { Route } from '@/routes/channels_/new';
import { Typography } from '@mui/material';
import Breadcrumbs from '@mui/material/Breadcrumbs';

export function NewChannelPage() {
  // The route code creates the "working channel"
  const workingChannel = Route.useLoaderData();

  return (
    <>
      <Breadcrumbs />
      {workingChannel && (
        <div>
          <Typography variant="h4" sx={{ mb: 2 }}>
            New Channel
          </Typography>
          <EditChannelForm channel={workingChannel} isNew={true} />
        </div>
      )}
    </>
  );
}
