import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import {
  RegisteredRouter,
  RouteIds,
  useBlocker,
  useLocation,
  useRouterState,
} from '@tanstack/react-router';
import { usePrevious } from '@uidotdev/usehooks';

type Props = {
  isDirty: boolean;
  onProceed?: CallableFunction;
  exemptPath?: RouteIds<RegisteredRouter['routeTree']>;
};

// Exempt paths are used in situations where the form spans multiple tabs or pages.
// This ensures the Alert is not activated in the middle of a form navigation.

export default function UnsavedNavigationAlert({
  isDirty,
  onProceed,
  exemptPath,
}: Props) {
  const location = useLocation();
  const previousLocation = usePrevious(location.pathname);
  const [isTransitioning, pendingMatches, resolvedLocation] = useRouterState({
    select: (state) =>
      [
        state.isTransitioning,
        state.pendingMatches,
        state.resolvedLocation,
      ] as const,
  });

  // console.log(previousLocation, location.pathname);

  // const pathnameMismatch = previousLocation !==

  const { proceed, status, reset } = useBlocker({
    blockerFn: () => {
      console.log(isTransitioning, pendingMatches, resolvedLocation);
      return true;
    },
    condition: isDirty && (pendingMatches?.length ?? 0) > 0,
  });

  const handleProceed = () => {
    proceed();
    if (onProceed) {
      onProceed();
    }
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
