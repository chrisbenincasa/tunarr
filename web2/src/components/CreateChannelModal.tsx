import Box from '@mui/material/Box';
import Modal from '@mui/material/Modal';
import { useState } from 'react';

const style = {
  position: 'absolute' as const,
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  bgcolor: 'background.paper',
  border: '2px solid #000',
  boxShadow: 24,
  p: 4,
};

interface CreateChannelModalProps {
  open: boolean;
}

export default function CreateChannelModal(props: CreateChannelModalProps) {
  const [open, setOpen] = useState(props.open);
  return (
    <Modal open={open} onClose={() => setOpen(false)} sx={style}>
      <Box>Create new Channel</Box>
    </Modal>
  );
}
