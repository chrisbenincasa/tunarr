import Breadcrumbs from '@/components/Breadcrumbs.tsx';
import { Trans } from '@lingui/react/macro';
import { Box, Typography } from '@mui/material';
import { createFileRoute } from '@tanstack/react-router';
import { SmartCollectionsTable } from '../../../components/smart_collections/SmartCollectionsTable.tsx';
import { getSmartCollectionsOptions } from '../../../generated/@tanstack/react-query.gen.ts';

export const Route = createFileRoute('/library/smart_collections/')({
  loader({ context: { queryClient } }) {
    return queryClient.ensureQueryData(getSmartCollectionsOptions());
  },
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <Box>
      <Breadcrumbs />
      <Box flexDirection={'column'} flexGrow={1} mb={2}>
        <Typography variant="h4"><Trans>Smart Collections</Trans></Typography>
        <Typography>
          <Trans>
            Smart Collections are self-updating content lists. You set the query
            and the collection automatically adds any new content from your
            library that fits those rules. Any newly added content matching query
            will not modify existing channel programming at this time.
          </Trans>
        </Typography>
      </Box>
      <SmartCollectionsTable />
    </Box>
  );
}
