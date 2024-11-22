import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { useBlocker } from '@tanstack/react-router';

type Props = {
  isDirty: boolean;
  onProceed?: CallableFunction;
  onCancel?: CallableFunction;
};

// Exempt paths are used in situations where the form spans multiple tabs or pages.
// This ensures the Alert is not activated in the middle of a form navigation.

export default function UnsavedNavigationAlert({
  isDirty,
  onProceed,
  onCancel,
}: Props) {
  const { proceed, status, reset } = useBlocker({
    condition: isDirty,
  });

  const handleProceed = () => {
    proceed();
    onProceed?.();
  };

  const handleCancel = () => {
    onCancel?.();
    reset();
  };

  return status === 'blocked' ? (
    <Dialog
      open={status === 'blocked'}
      onClose={handleCancel}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">
        {'You have unsaved changes!'}
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="alert-dialog-description">
          If you proceed, all unsaved changes will be lost. Are you sure you
          want to proceed?
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel}>Cancel</Button>
        <Button onClick={handleProceed} autoFocus variant="contained">
          Proceed
        </Button>
      </DialogActions>
    </Dialog>
  ) : null;
}
