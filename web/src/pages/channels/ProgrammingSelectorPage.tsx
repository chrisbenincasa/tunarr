import { useNavigate } from 'react-router-dom';
import Breadcrumbs from '../../components/Breadcrumbs.tsx';
import PaddedPaper from '../../components/base/PaddedPaper.tsx';
import ProgrammingSelector from '../../components/channel_config/ProgrammingSelector.tsx';
import { addMediaToCurrentChannel } from '../../store/channelEditor/actions.ts';

export default function ProgrammingSelectorPage() {
  const navigate = useNavigate();
  return (
    <>
      <Breadcrumbs />
      <PaddedPaper>
        <ProgrammingSelector
          onAddSelectedMedia={addMediaToCurrentChannel}
          onAddMediaSuccess={() => navigate('..', { relative: 'path' })}
        />
      </PaddedPaper>
    </>
  );
}
