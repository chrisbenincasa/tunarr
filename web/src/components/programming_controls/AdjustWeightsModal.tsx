import { Box, ButtonGroup, DialogContentText } from '@mui/material';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { Trans } from '@lingui/react/macro';

type AdjustWeightsModalProps = {
  open: boolean;
  onClose: () => void;
};

const AdjustWeightsModal = ({ open, onClose }: AdjustWeightsModalProps) => {
  const adjustWeightProgramming = () => {
    console.log('To do');
  };

  return (
    <Dialog open={open}>
      <DialogTitle><Trans>Adjust Weights</Trans></DialogTitle>
      <DialogContent>
        <DialogContentText>
          <Trans>This allows you to pick the weights for each of the shows, so you can
          decide that some shows should be less frequent than other shows.</Trans>
        </DialogContentText>
        <ButtonGroup>
          <Button variant="contained"><Trans>Manual</Trans></Button>
          <Button><Trans>Automatic</Trans></Button>
        </ButtonGroup>
        <Box sx={{ display: 'flex', my: 1 }}>{/* To do */}</Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()}><Trans>Cancel</Trans></Button>
        <Button variant="contained" onClick={() => adjustWeightProgramming()}>
          <Trans>Save</Trans>
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AdjustWeightsModal;
