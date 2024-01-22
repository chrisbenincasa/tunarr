import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import ProgrammingSelector from '../../components/channel_config/ProgrammingSelector.tsx';
import { TextField } from '@mui/material';
import PaddedPaper from '../../components/base/PaddedPaper.tsx';

export default function EditCustomShowPage() {
  return (
    <div>
      <Box>
        <Typography variant="h4" sx={{ mb: 2 }}>
          New Custom Show
        </Typography>
      </Box>
      <PaddedPaper sx={{ mb: 2 }}>
        <TextField fullWidth label="Name" />
      </PaddedPaper>
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          Add Programming
        </AccordionSummary>
        <AccordionDetails>
          <ProgrammingSelector />
        </AccordionDetails>
      </Accordion>
    </div>
  );
}
