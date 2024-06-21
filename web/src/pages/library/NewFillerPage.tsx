import Breadcrumbs from '@/components/Breadcrumbs';
import PaddedPaper from '@/components/base/PaddedPaper';
import { EditFillerListForm } from '@/components/filler/EditFillerListForm';
import { Route } from '@/routes/library/fillers_.new';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export function NewFillerPage() {
  const { fillerList, programming: fillerListPrograms } = Route.useLoaderData();
  return (
    <Box>
      <Breadcrumbs />
      <Box>
        <Box>
          <Typography variant="h4" sx={{ mb: 2 }}>
            New Filler List
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
