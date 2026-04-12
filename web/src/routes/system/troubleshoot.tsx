import { createFileRoute } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import { isNonEmptyString } from '@tunarr/shared/util';
import { z } from 'zod';
import { getProgramByIdOptions } from '../../generated/@tanstack/react-query.gen.ts';
import { TroubleshootPage } from '../../pages/system/TroubleshootPage.tsx';

const troubleshootParams = z.object({
  programId: z.uuid().optional(),
});

type TroubleshootParams = z.infer<typeof troubleshootParams>;

export const Route = createFileRoute('/system/troubleshoot')({
  validateSearch: zodValidator(troubleshootParams),
  loaderDeps: ({ search }) => ({ programId: search.programId }),
  loader: async ({ context, location }) => {
    const search = location.search as TroubleshootParams;
    if (isNonEmptyString(search.programId)) {
      return context.queryClient.ensureQueryData({
        ...getProgramByIdOptions({ path: { id: search.programId } }),
      });
    }
    return null;
  },
  component: Page,
});

function Page() {
  const maybeProgram = Route.useLoaderData();
  return <TroubleshootPage initialProgram={maybeProgram} />;
}
