import type { DialogProps } from '@mui/material';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';

type Props = {
  open: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
  onClose: () => void;
  title: string;
  body?: string;
  dialogProps?: Omit<DialogProps, 'open' | 'onClose'>;
};

export const DeleteConfirmationDialog = ({
  open,
  title,
  body,
  onConfirm,
  onCancel,
  onClose,
  dialogProps,
}: Props) => {
  const confirm = () => {
    onConfirm();
    onClose();
  };

  const cancel = () => {
    onCancel?.();
    onClose();
  };

  return (
    <Dialog open={open} onClose={() => onClose()} {...dialogProps}>
      <DialogTitle>{title}</DialogTitle>
      {body && (
        <DialogContent>
          <DialogContentText>{body}</DialogContentText>
        </DialogContent>
      )}
      <DialogActions>
        <Button onClick={() => cancel()}>Cancel</Button>
        <Button variant="contained" color="error" onClick={() => confirm()}>
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
};
