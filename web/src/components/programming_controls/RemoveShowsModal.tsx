import { Checkbox, DialogContentText, List, ListItem } from '@mui/material';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import _ from 'lodash-es';
import { useState } from 'react';
import { useRemoveShow } from '../../hooks/programming_controls/useRemoveShow';
import useStore from '../../store';
import { materializedProgramListSelector } from '../../store/selectors';
import { UIContentProgram, isUIContentProgram } from '../../types';

type RemoveShowsModalProps = {
  open: boolean;
  onClose: () => void;
};

const RemoveShowsModal = ({ open, onClose }: RemoveShowsModalProps) => {
  const [checked, setChecked] = useState<string[]>([]);

  const removeShow = useRemoveShow();

  const programs = useStore(materializedProgramListSelector);
  const onlyShows = _.filter(
    programs,
    (program): program is UIContentProgram => {
      return isUIContentProgram(program) && program.subtype === 'episode';
    },
  );

  const showList: string[] = [];
  _.uniqBy(onlyShows, (program) => program.title).map((program) =>
    showList.push(program.title),
  );

  const handleToggle = (value: string) => () => {
    const currentIndex = checked.indexOf(value);
    const newChecked = [...checked];

    if (currentIndex === -1) {
      newChecked.push(value);
    } else {
      newChecked.splice(currentIndex, 1);
    }

    setChecked(newChecked);
  };

  const removeShowsProgramming = () => {
    removeShow(checked);
    onClose();
  };

  return (
    <Dialog open={open}>
      <DialogTitle>Remove Shows</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Pick specific shows to remove from the channel.
        </DialogContentText>
        <List>
          {showList.map((title) => {
            return (
              <ListItem
                secondaryAction={
                  <Checkbox
                    edge="end"
                    onChange={handleToggle(title)}
                    checked={checked.indexOf(title) !== -1}
                    inputProps={{ 'aria-labelledby': 'Select Show' }}
                  />
                }
              >
                {title}
              </ListItem>
            );
          })}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => removeShowsProgramming()}
          disabled={checked.length === 0}
        >
          {`Remove ${checked.length} show${checked.length === 1 ? '' : 's'}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RemoveShowsModal;
