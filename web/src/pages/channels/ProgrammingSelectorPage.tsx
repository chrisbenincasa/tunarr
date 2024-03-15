import Breadcrumbs from '../../components/Breadcrumbs.tsx';
import PaddedPaper from '../../components/base/PaddedPaper.tsx';
import ProgrammingSelector from '../../components/channel_config/ProgrammingSelector.tsx';
import { addMediaToCurrentChannel } from '../../store/channelEditor/actions.ts';

export default function ProgrammingSelectorPage() {
  return (
    <>
      <Breadcrumbs />
      <PaddedPaper>
        {/* TODO: This shouldn't assume we are editing a channel. You can also add media to a custom show or filler show */}
        <ProgrammingSelector onAddSelectedMedia={addMediaToCurrentChannel} />
      </PaddedPaper>
    </>
  );
}
