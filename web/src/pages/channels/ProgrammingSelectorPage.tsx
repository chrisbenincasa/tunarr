import SelectedProgrammingList from '@/components/channel_config/SelectedProgrammingList.tsx';
import { SearchRequest } from '@tunarr/types/api';
import { useCallback, useState } from 'react';
import Breadcrumbs from '../../components/Breadcrumbs.tsx';
import PaddedPaper from '../../components/base/PaddedPaper.tsx';
import { ProgrammingSelector } from '../../components/channel_config/ProgrammingSelector.tsx';

// These change depending on which entity we are editing,
type Props = {
  initialMediaSourceId?: string;
  initialLibraryId?: string;
  initialSearchRequest?: SearchRequest;
};

export default function ProgrammingSelectorPage({
  initialMediaSourceId,
  initialLibraryId,
  initialSearchRequest,
}: Props) {
  const [open, setOpen] = useState(false);

  const toggleDrawer = useCallback((open: boolean) => {
    setOpen(open);
  }, []);

  return (
    <>
      <Breadcrumbs />
      <PaddedPaper>
        <ProgrammingSelector
          initialMediaSourceId={initialMediaSourceId}
          initialLibraryId={initialLibraryId}
          initialSearchRequest={initialSearchRequest}
          toggleOrSetSelectedProgramsDrawer={toggleDrawer}
        />

        <SelectedProgrammingList
          toggleOrSetSelectedProgramsDrawer={toggleDrawer}
          isOpen={open}
        />
      </PaddedPaper>
    </>
  );
}
