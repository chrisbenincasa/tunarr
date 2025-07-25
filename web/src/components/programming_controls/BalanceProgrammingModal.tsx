import type { BalanceProgramsOptions } from '@/hooks/programming_controls/useBalancePrograms';
import { useBalancePrograms } from '@/hooks/programming_controls/useBalancePrograms';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useState } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
};

export const BalanceProgrammingModal = ({ open, onClose }: Props) => {
  const balancePrograms = useBalancePrograms();
  const [balanceType, setBalanceType] =
    useState<BalanceProgramsOptions['balanceType']>('duration');

  const handleChange = (
    _event: React.MouseEvent<HTMLElement>,
    balanceType: string | null,
  ) => {
    if (balanceType === 'duration' || balanceType === 'programCount') {
      setBalanceType(balanceType);
    }
  };

  const runBalance = () => {
    balancePrograms({ balanceType });
    onClose();
  };

  return (
    <Dialog open={open}>
      <DialogTitle>Balance Prorgramming</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Attempts to balance programming groups by either total lineup duration
          or number of unique programs. For instance, for a channel with many
          seasons of one show and few seasons of another, balancing will attempt
          to create an even mix of both shows by inserting repeats of the show
          with fewer episodes.
        </DialogContentText>
        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column' }}>
          <Typography sx={{ mb: 1 }}>Balance By:</Typography>
          <ToggleButtonGroup
            color="primary"
            value={balanceType}
            exclusive
            onChange={handleChange}
            sx={{ flex: 1, alignSelf: 'center' }}
          >
            <ToggleButton value="duration">Duration</ToggleButton>
            <ToggleButton value="programCount">Program Count</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()}>Cancel</Button>
        <Button variant="contained" onClick={() => runBalance()}>
          Balance
        </Button>
      </DialogActions>
    </Dialog>
  );
};
