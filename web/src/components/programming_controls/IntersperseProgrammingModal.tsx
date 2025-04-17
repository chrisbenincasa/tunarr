import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { useInterspersePrograms } from '../../hooks/programming_controls/useInterspersePrograms.ts';

type Props = {
  open: boolean;
  onClose: () => void;
};

export const IntersperseProgrammingModal = ({ open, onClose }: Props) => {
  const runIntersperse = useInterspersePrograms();

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Intersperse</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Insert programming before or after other programming.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()}>Cancel</Button>
        <Button variant="contained" onClick={() => runIntersperse()}>
          Intersperse
        </Button>
      </DialogActions>
    </Dialog>
  );
};
