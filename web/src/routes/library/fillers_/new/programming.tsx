import ProgrammingSelectorPage from '@/pages/channels/ProgrammingSelectorPage';
import { addMediaToCurrentFillerList } from '@/store/fillerListEditor/action';
import { createFileRoute } from '@tanstack/react-router';
import { noop } from 'ts-essentials';
import { ProgrammingSelectionContext } from '../../../../context/ProgrammingSelectionContext.ts';

export const Route = createFileRoute('/library/fillers_/new/programming')({
  component: FillerProgrammingSelectorPage,
});

function FillerProgrammingSelectorPage() {
  const navigate = Route.useNavigate();
  return (
    <ProgrammingSelectionContext.Provider
      value={{
        onAddSelectedMedia: addMediaToCurrentFillerList,
        onAddMediaSuccess: () => {
          navigate({ to: '..' }).catch(console.error);
        },
        onSourceChange: noop,
        onSearchChange: noop,
        entityType: 'filler-list',
      }}
    >
      <ProgrammingSelectorPage />
    </ProgrammingSelectionContext.Provider>
  );
}
