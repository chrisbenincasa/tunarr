import { Box, Typography } from '@mui/material';
import { createFileRoute } from '@tanstack/react-router';
import { SmartCollectionsTable } from '../../../components/smart_collections/SmartCollectionsTable.tsx';
import { getApiSmartCollectionsOptions } from '../../../generated/@tanstack/react-query.gen.ts';

export const Route = createFileRoute('/library/smart_collections/')({
  loader({ context: { queryClient } }) {
    return queryClient.ensureQueryData(getApiSmartCollectionsOptions());
  },
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Smart Collections
      </Typography>
      <SmartCollectionsTable />
    </Box>
  );
}
