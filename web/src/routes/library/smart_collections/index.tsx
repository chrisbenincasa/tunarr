import { createFileRoute } from '@tanstack/react-router';
import { getApiSmartCollectionsOptions } from '../../../generated/@tanstack/react-query.gen.ts';
import SmartCollectionsPage from '../../../pages/library/SmartCollectionsPage.tsx';

export const Route = createFileRoute('/library/smart_collections/')({
  loader({ context: { queryClient } }) {
    return queryClient.ensureQueryData(getApiSmartCollectionsOptions());
  },
  component: SmartCollectionsPage,
});
