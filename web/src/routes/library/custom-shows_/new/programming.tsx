import ProgrammingSelectorPage from '@/pages/channels/ProgrammingSelectorPage';
import { addMediaToCurrentCustomShow } from '@/store/customShowEditor/actions';
import { createFileRoute } from '@tanstack/react-router';
import { noop } from 'lodash-es';
import { ProgrammingSelectionContext } from '../../../../context/ProgrammingSelectionContext.ts';

export const Route = createFileRoute('/library/custom-shows_/new/programming')({
  component: CustomShowProgrammingSelectorPage,
});

function CustomShowProgrammingSelectorPage() {
  const navigate = Route.useNavigate();
  return (
    <ProgrammingSelectionContext.Provider
      value={{
        onAddSelectedMedia: addMediaToCurrentCustomShow,
        onAddMediaSuccess: () => {
          navigate({ to: '..' }).catch(console.error);
        },
        entityType: 'custom-show',
        onSourceChange: noop,
        onSearchChange: noop,
      }}
    >
      <ProgrammingSelectorPage />
    </ProgrammingSelectionContext.Provider>
  );
}
