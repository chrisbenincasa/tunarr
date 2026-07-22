import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  TextField,
  Typography,
} from '@mui/material';

type Props = {
  filterString: string;
  onFilterStringChange: (value: string) => void;
};

export function AdvancedFilterSection({
  filterString,
  onFilterStringChange,
}: Props) {
  return (
    <Accordion disableGutters sx={{ mt: 2, '&::before': { display: 'none' } }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="body2">Advanced Filter</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Alert severity="info" sx={{ mb: 2 }}>
          Advanced filters combine with the selections above using AND logic.
          Content must match both your picker selections and this filter.
        </Alert>
        <TextField
          fullWidth
          size="small"
          label="Filter DSL"
          placeholder='e.g., genre = "Action" AND year > 1990'
          value={filterString}
          onChange={(e) => onFilterStringChange(e.target.value)}
          helperText="Syntax: field op value. Operators: =, !=, >, <, >=, <=, in, contains"
          multiline
          minRows={2}
        />
      </AccordionDetails>
    </Accordion>
  );
}
