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

type ContentProps = {
  title: string;
  body?: string;
  onConfirm: () => void;
  onClose: () => void;
  onCancel?: () => void;
};

const DeleteConfirmationDialogContent = ({
  title,
  body,
  onClose,
  onCancel,
  onConfirm,
}: ContentProps) => {
  const confirm = () => {
    onConfirm();
    onClose();
  };
  const cancel = () => {
    onCancel?.();
    onClose();
  };

  return (
    <>
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
    </>
  );
};

export const DeleteConfirmationDialog = (props: Props) => {
  const { open, onClose, dialogProps } = props;

  return (
    <Dialog open={open} onClose={() => onClose()} {...dialogProps}>
      <DeleteConfirmationDialogContent {...props} />
    </Dialog>
  );
};
