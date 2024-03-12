import { Widgets as ShuffleIcon } from '@mui/icons-material';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  FormGroup,
  InputLabel,
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
        <DialogContentText>
          Alternate TV shows in blocks of episodes. You can pick the number of
          episodes per show in each block and if the order of shows in each
          block should be randomized. Movies are moved to the bottom.
        </DialogContentText>
        <FormGroup sx={{ my: 3 }}>
          <TextField
            type="number"
            label="# of Programs"
            value={blockShuffleProgramCount}
            sx={{ mb: 2 }}
            onChange={(e) =>
              setBlockShuffleProgramCount(parseInt(e.target.value))
            }
          ></TextField>
          <FormControl fullWidth>
            <InputLabel id="sort-block-shuffle-type">Type</InputLabel>
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
          </FormControl>
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
