import Breadcrumbs from '@/components/Breadcrumbs';
import PaddedPaper from '@/components/base/PaddedPaper';
import { EditFillerListForm } from '@/components/filler/EditFillerListForm';
import { useSuspendedStore } from '@/hooks/useSuspendedStore.ts';
import useStore from '@/store/index.ts';
import { Trans } from '@lingui/react/macro';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export function NewFillerPage() {
  const fillerList = useSuspendedStore((s) => s.fillerListEditor.currentEntity);
  const fillerListPrograms = useStore((s) => s.fillerListEditor.programList);

  return (
    <Box>
      <Breadcrumbs />
      <Box>
        <Box>
          <Typography variant="h4" sx={{ mb: 2 }}>
            <Trans>New Filler List</Trans>
          </Typography>
        </Box>
        <PaddedPaper sx={{ mb: 2 }}>
          <EditFillerListForm
            fillerList={fillerList}
            fillerListPrograms={fillerListPrograms}
            isNew={true}
          />
        </PaddedPaper>
      </Box>
    </Box>
  );
}
