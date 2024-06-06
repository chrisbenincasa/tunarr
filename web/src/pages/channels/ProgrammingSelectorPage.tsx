import SelectedProgrammingList from '@/components/channel_config/SelectedProgrammingList.tsx';
import Breadcrumbs from '../../components/Breadcrumbs.tsx';
import PaddedPaper from '../../components/base/PaddedPaper.tsx';
import ProgrammingSelector from '../../components/channel_config/ProgrammingSelector.tsx';
import { useNavigate } from 'react-router-dom';
import { addMediaToCurrentChannel } from '@/store/channelEditor/actions.ts';
import useStore from '@/store/index.ts';

export default function ProgrammingSelectorPage() {
  const selectedLibrary = useStore((s) => s.currentLibrary);
  console.log(selectedLibrary);
  const navigate = useNavigate();
  return (
    <>
      <Breadcrumbs />
      <PaddedPaper>
        <ProgrammingSelector />
        <SelectedProgrammingList
          onAddSelectedMedia={addMediaToCurrentChannel}
          onAddMediaSuccess={() => navigate(-1)}
          selectAllEnabled={selectedLibrary?.type === 'plex'}
        />
      </PaddedPaper>
    </>
  );
}
