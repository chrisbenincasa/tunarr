import { Widgets as ShuffleIcon } from '@mui/icons-material';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormGroup,
  MenuItem,
  Select,
  TextField,
} from '@mui/material';
import { useState } from 'react';
import {
  BlockShuffleProgramCount,
  BlockShuffleType,
  useBlockShuffle,
} from '../../hooks/programming_controls/useBlockShuffle';

type AddBlockShuffleModalProps = {
  open: boolean;
  onClose: () => void;
};

const AddBlockShuffleModal = ({ open, onClose }: AddBlockShuffleModalProps) => {
  const blockShuffle = useBlockShuffle();
  const [blockShuffleProgramCount, setBlockShuffleProgramCount] =
    useState<BlockShuffleProgramCount>(2);
  const [blockShuffleType, setBlockShuffleType] =
    useState<BlockShuffleType>('Fixed');

  const handleBlockShuffle = () => {
    const options = {
      programCount: blockShuffleProgramCount,
      type: blockShuffleType,
    };

    if (blockShuffleProgramCount && blockShuffleType) {
      blockShuffle(options);
    }
    onClose();
  };

  return (
    <Dialog open={open}>
      <DialogTitle>Block Shuffle</DialogTitle>
      <DialogContent sx={{ py: 0 }}>
        <FormGroup sx={{ my: 1 }}>
          <TextField
            type="number"
            label="# of Programs"
            value={blockShuffleProgramCount}
            sx={{ mb: 1 }}
            onChange={(e) =>
              setBlockShuffleProgramCount(parseInt(e.target.value))
            }
          ></TextField>
          <Select
            id="sort-block-shuffle-type"
            value={blockShuffleType}
            label="Type"
            onChange={(e) =>
              setBlockShuffleType(e.target.value as BlockShuffleType)
            }
          >
            <MenuItem value={'Fixed'}>Fixed</MenuItem>
            <MenuItem value={'Random'}>Random</MenuItem>
          </Select>
        </FormGroup>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()}>Cancel</Button>
        <Button
          onClick={() => handleBlockShuffle()}
          startIcon={<ShuffleIcon />}
          variant="contained"
        >
          Block Shuffle
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddBlockShuffleModal;
