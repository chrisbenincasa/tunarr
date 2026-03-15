import { EditCustomShowsForm } from '@/components/custom-shows/EditCustomShowForm.tsx';
import { useCustomShowWithProgramming } from '@/hooks/useCustomShows.ts';
import { Route } from '@/routes/library/custom-shows_/$showId/edit.tsx';
import useStore from '@/store/index.ts';
import { LinearProgress } from '@mui/material';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Breadcrumbs from '../../components/Breadcrumbs.tsx';
import PaddedPaper from '../../components/base/PaddedPaper.tsx';

type Props = { isNew?: boolean };

export default function EditCustomShowPage({ isNew }: Props) {
  const { showId } = Route.useParams();
  const [{ data: customShow }] = useCustomShowWithProgramming(showId);
  const customShowPrograms = useStore((s) => s.customShowEditor.programList);

  return !customShow ? (
    <LinearProgress />
  ) : (
    <Box>
      <Box>
        <Breadcrumbs />
        <Typography variant="h4" sx={{ mb: 2 }}>
          {isNew ? 'New Custom Show' : customShow.name}
        </Typography>
      </Box>
      <PaddedPaper sx={{ mb: 2 }}>
        <EditCustomShowsForm
          isNew={false}
          customShow={customShow}
          customShowPrograms={customShowPrograms}
        />
      </PaddedPaper>
    </Box>
  );
}
