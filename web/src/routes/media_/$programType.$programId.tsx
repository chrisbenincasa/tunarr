import { ProgramPage } from '@/pages/media/ProgramPage';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { isGroupingItemType, isTerminalItemType } from '@tunarr/types';

export const Route = createFileRoute('/media_/$programType/$programId')({
  // eslint-disable-next-line @typescript-eslint/require-await
  beforeLoad: async ({ params }) => {
    const { programType, programId } = params;
    if (!isTerminalItemType(programType) && !isGroupingItemType(programType)) {
      throw notFound();
    }
    return {
      programType: programType,
      programId,
    };
  },
  component: ProgramPage,
});
