import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import React from 'react';
import { BlockerFunction, matchPath, useBlocker } from 'react-router-dom';

type Props = {
  isDirty: boolean;
  exemptPath?: string;
  onProceed?: CallableFunction;
};

// Exempt paths are used in situations where the form spans multiple tabs or pages.
// This ensures the Alert is not activated in the middle of a form navigation.

export default function UnsavedNavigationAlert(props: Props) {
  const { isDirty, exemptPath, onProceed } = props;

  let shouldBlock = React.useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation }) => {
      const isExemptPath = matchPath(exemptPath || '', nextLocation.pathname);

      return (
        isDirty &&
        !isExemptPath &&
        currentLocation.pathname !== nextLocation.pathname
      );
    },
    [isDirty],
  );
  let blocker = useBlocker(shouldBlock);

  const handleProceed = () => {
    blocker.proceed?.();
    if (onProceed) {
      onProceed();
    }
  };

  return blocker && blocker.state === 'blocked' ? (
    <Dialog
      open={blocker.state === 'blocked'}
      onClose={() => blocker.reset?.()}
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
        <Button onClick={() => blocker.reset?.()}>Cancel</Button>
        <Button onClick={handleProceed} autoFocus variant="contained">
          Proceed
        </Button>
      </DialogActions>
    </Dialog>
  ) : null;
}
