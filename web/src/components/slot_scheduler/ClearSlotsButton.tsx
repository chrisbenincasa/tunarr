import { ClearAll } from '@mui/icons-material';
import { Button } from '@mui/material';

type Props = {
  fields: { id: string }[];
  remove: () => void;
};

export const ClearSlotsButton = ({ fields, remove }: Props) => {
  return (
    fields.length > 0 && (
      <Button onClick={() => remove()} sx={{ mr: 1 }} startIcon={<ClearAll />}>
        Clear All
      </Button>
    )
  );
};
