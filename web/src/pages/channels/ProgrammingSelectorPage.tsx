import SelectedProgrammingList from '@/components/channel_config/SelectedProgrammingList.tsx';
import { AddedMedia } from '@/types/index.ts';
import Breadcrumbs from '../../components/Breadcrumbs.tsx';
import PaddedPaper from '../../components/base/PaddedPaper.tsx';
import ProgrammingSelector from '../../components/channel_config/ProgrammingSelector.tsx';

// These change depending on which entity we are editing,
type Props = {
  onAddSelectedMedia: (programs: AddedMedia[]) => void;
  onAddMediaSuccess: () => void;
  initialMediaSourceId?: string;
  initialLibraryId?: string;
};

export default function ProgrammingSelectorPage({
  onAddMediaSuccess,
  onAddSelectedMedia,
  initialMediaSourceId,
  initialLibraryId,
}: Props) {
  return (
    <>
      <Breadcrumbs />
      <PaddedPaper>
        <ProgrammingSelector
          initialMediaSourceId={initialMediaSourceId}
          initialLibraryId={initialLibraryId}
        />
        <SelectedProgrammingList
          onAddSelectedMedia={onAddSelectedMedia}
          onAddMediaSuccess={onAddMediaSuccess}
        />
      </PaddedPaper>
    </>
  );
}
