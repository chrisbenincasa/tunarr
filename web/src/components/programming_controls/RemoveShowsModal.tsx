import { Checkbox, DialogContentText, List, ListItem } from '@mui/material';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { chain } from 'lodash-es';
import { useMemo, useState } from 'react';
import { useRemoveShow } from '../../hooks/programming_controls/useRemoveShow';
import useStore from '../../store';
import { materializedProgramListSelector } from '../../store/selectors';
import { UIContentProgram, isUIContentProgram } from '../../types';

type RemoveShowsModalProps = {
  open: boolean;
  onClose: () => void;
};

const RemoveShowsModal = ({ open, onClose }: RemoveShowsModalProps) => {
  const [checked, setChecked] = useState(new Set<string>());

  const removeShow = useRemoveShow();

  const programs = useStore(materializedProgramListSelector);
  const showList = useMemo(
    () =>
      chain(programs)
        .filter((program): program is UIContentProgram => {
          return isUIContentProgram(program) && program.subtype === 'episode';
        })
        .uniqBy((program) => program.showId ?? program.title)
        .map((p) => ({ title: p.title, id: p.showId ?? p.title }))
        .value(),
    [programs],
  );

  const handleToggle = (value: string) => {
    setChecked((prev) => {
      // New reference, force render
      const set = new Set(prev);
      if (set.has(value)) {
        set.delete(value);
        return set;
      } else {
        return set.add(value);
      }
    });
  };

  const removeShowsProgramming = () => {
    removeShow([...checked]);
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
          {showList.map(({ title, id }) => {
            return (
              <ListItem
                key={id}
                secondaryAction={
                  <Checkbox
                    edge="end"
                    onChange={() => handleToggle(id)}
                    checked={checked.has(id)}
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
          disabled={checked.size === 0}
        >
          {`Remove ${checked.size} show${checked.size === 1 ? '' : 's'}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RemoveShowsModal;
