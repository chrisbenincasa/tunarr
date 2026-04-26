import { EditCustomShowsForm } from '@/components/custom-shows/EditCustomShowForm.tsx';
import { useSuspendedStore } from '@/hooks/useSuspendedStore.ts';
import useStore from '@/store/index.ts';
import { Trans } from '@lingui/react/macro';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Breadcrumbs from '../../components/Breadcrumbs.tsx';
import PaddedPaper from '../../components/base/PaddedPaper.tsx';

export function NewCustomShowPage() {
  const customShow = useSuspendedStore((s) => s.customShowEditor.currentEntity);
  const customShowPrograms = useStore((s) => s.customShowEditor.programList);

  return (
    <Box>
      <Box>
        <Breadcrumbs />
        <Typography variant="h4" sx={{ mb: 2 }}>
          <Trans>New Custom Show</Trans>
        </Typography>
      </Box>
      <PaddedPaper sx={{ mb: 2 }}>
        <EditCustomShowsForm
          isNew={true}
          customShow={customShow}
          customShowPrograms={customShowPrograms}
        />
      </PaddedPaper>
    </Box>
  );
}
