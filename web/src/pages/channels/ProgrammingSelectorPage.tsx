import SelectedProgrammingList from '@/components/channel_config/SelectedProgrammingList.tsx';
import {
  addMediaToCurrentChannel,
  addMediaToCurrentCustomShow,
  addMediaToCurrentFillerList,
} from '@/store/channelEditor/actions.ts';
import useStore from '@/store/index.ts';
import { useLocation, useNavigate } from 'react-router-dom';
import Breadcrumbs from '../../components/Breadcrumbs.tsx';
import PaddedPaper from '../../components/base/PaddedPaper.tsx';
import ProgrammingSelector from '../../components/channel_config/ProgrammingSelector.tsx';

export default function ProgrammingSelectorPage() {
  const selectedLibrary = useStore((s) => s.currentLibrary);
  const navigate = useNavigate();
  const location = useLocation();

  const displayPaths = [
    {
      path: 'fillers/programming/add',
      onMediaAdd: addMediaToCurrentFillerList,
    },
    {
      path: 'custom-shows/programming/add',
      onMediaAdd: addMediaToCurrentCustomShow,
    },
    {
      path: 'channels/:id/programming/add',
      onMediaAdd: addMediaToCurrentChannel,
    },
  ];
  const displaySelectedProgramming = displayPaths.find((pathObject) => {
    const { path } = pathObject; // Destructure path from the object
    return location.pathname.match(new RegExp(path));
  });

  return (
    <>
      <Breadcrumbs />
      <PaddedPaper>
        <ProgrammingSelector />
        <SelectedProgrammingList
          onAddSelectedMedia={
            displaySelectedProgramming?.onMediaAdd || addMediaToCurrentChannel
          }
          onAddMediaSuccess={() => navigate(-1)}
          selectAllEnabled={selectedLibrary?.type === 'plex'}
        />
      </PaddedPaper>
    </>
  );
}
