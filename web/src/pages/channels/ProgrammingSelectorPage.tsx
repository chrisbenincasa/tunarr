import SelectedProgrammingList from '@/components/channel_config/SelectedProgrammingList.tsx';
import { useState } from 'react';
import Breadcrumbs from '../../components/Breadcrumbs.tsx';
import PaddedPaper from '../../components/base/PaddedPaper.tsx';
import ProgrammingSelector from '../../components/channel_config/ProgrammingSelector.tsx';

// These change depending on which entity we are editing,
type Props = {
  initialMediaSourceId?: string;
  initialLibraryId?: string;
};

export default function ProgrammingSelectorPage({
  initialMediaSourceId,
  initialLibraryId,
}: Props) {
  const [open, setOpen] = useState(false);

  const toggleDrawer = (open: boolean) => {
    setOpen(open);
  };

  return (
    <>
      <Breadcrumbs />
      <PaddedPaper>
        <ProgrammingSelector
          initialMediaSourceId={initialMediaSourceId}
          initialLibraryId={initialLibraryId}
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
