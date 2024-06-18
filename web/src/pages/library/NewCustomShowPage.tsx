import { EditCustomShowsForm } from '@/components/custom-shows/EditCustomShowForm.tsx';
import { Route } from '@/routes/library/custom-shows_.new';
import useStore from '@/store/index.ts';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Breadcrumbs from '../../components/Breadcrumbs.tsx';
import PaddedPaper from '../../components/base/PaddedPaper.tsx';

export function NewCustomShowPage() {
  const { customShow } = Route.useLoaderData();
  const customShowPrograms = useStore((s) => s.customShowEditor.programList);

  return (
    <Box>
      <Box>
        <Breadcrumbs />
        <Typography variant="h4" sx={{ mb: 2 }}>
          New Custom Show
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
