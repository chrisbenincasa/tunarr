import { EditFillerListForm } from '@/components/filler/EditFillerListForm.tsx';
import { useFillerListWithProgramming } from '@/hooks/useFillerLists.ts';
import { Route } from '@/routes/library/fillers_/$fillerId/edit.tsx';
import useStore from '@/store/index.ts';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Breadcrumbs from '../../components/Breadcrumbs.tsx';
import PaddedPaper from '../../components/base/PaddedPaper.tsx';

export default function EditFillerPage() {
  const { fillerId } = Route.useParams();
  const [{ data: fillerList }] = useFillerListWithProgramming(fillerId);
  const fillerListPrograms = useStore((s) => s.fillerListEditor.programList);

  return (
    <Box>
      <Breadcrumbs />
      <Box>
        <Box>
          <Typography variant="h4" sx={{ mb: 2 }}>
            Edit Filler List
          </Typography>
        </Box>
        <PaddedPaper sx={{ mb: 2 }}>
          <EditFillerListForm
            fillerList={fillerList}
            fillerListPrograms={fillerListPrograms}
            isNew={false}
          />
        </PaddedPaper>
      </Box>
    </Box>
  );
}
