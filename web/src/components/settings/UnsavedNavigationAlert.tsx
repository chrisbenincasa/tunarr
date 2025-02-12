import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import type { AnyRoute } from '@tanstack/react-router';
import { useBlocker } from '@tanstack/react-router';
import { isEmpty } from 'lodash-es';

type AvailablePaths<TRoute extends AnyRoute = AnyRoute> = TRoute['fullPath'];

type Props = {
  isDirty: boolean;
  exceptTargetPaths?: AvailablePaths[];
  onProceed?: () => void;
};

// Exempt paths are used in situations where the form spans multiple tabs or pages.
// This ensures the Alert is not activated in the middle of a form navigation.

export default function UnsavedNavigationAlert({
  isDirty,
  exceptTargetPaths,
  onProceed,
}: Props) {
  const { proceed, status, reset } = useBlocker({
    shouldBlockFn: ({ next }) => {
      if (exceptTargetPaths && !isEmpty(exceptTargetPaths)) {
        for (const excludedTarget of exceptTargetPaths) {
          if (next.fullPath === excludedTarget) {
            return false;
          }
        }
      }
      return isDirty;
    },
    withResolver: true,
  });

  const handleProceed = () => {
    proceed?.();
    onProceed?.();
  };

  return status === 'blocked' ? (
    <Dialog
      open={status === 'blocked'}
      onClose={reset}
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
        <Button onClick={reset}>Cancel</Button>
        <Button onClick={handleProceed} autoFocus variant="contained">
          Proceed
        </Button>
      </DialogActions>
    </Dialog>
  ) : null;
}
