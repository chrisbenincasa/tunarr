import { betterHumanize } from '@/helpers/dayjs';
import { isNonEmptyString } from '@/helpers/util';
import {
  Checkbox,
  DialogContentText,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { seq } from '@tunarr/shared/util';
import dayjs from 'dayjs';
import {
  every,
  includes,
  isEmpty,
  map,
  reduce,
  reject,
  some,
  uniqBy,
  values,
} from 'lodash-es';
import pluralize from 'pluralize';
import { useMemo, useState } from 'react';
import { useCounter } from 'usehooks-ts';
import {
  RemoveProgrammingRequest,
  useRemoveProgramming,
} from '../../hooks/programming_controls/useRemoveProgramming';
import useStore from '../../store';
import { materializedProgramListSelector } from '../../store/selectors';

type RemoveShowsModalProps = {
  open: boolean;
  onClose: () => void;
};

export const RemoveShowsModal = ({ open, onClose }: RemoveShowsModalProps) => {
  const { count, increment, decrement } = useCounter(0);

  const removeProgramming = useRemoveProgramming();

  const programs = useStore(materializedProgramListSelector);
  const hasMovies = useMemo(() => {
    return some(programs, (p) => p.type === 'content' && p.subtype === 'movie');
  }, [programs]);

  const numAndDurationById = useMemo(() => {
    return reduce(
      programs,
      (acc, curr) => {
        let key: string | undefined;
        switch (curr.type) {
          case 'content': {
            switch (curr.subtype) {
              case 'movie':
                key = 'movie';
                break;
              case 'episode':
                key = curr.showId;
                break;
              case 'track':
                key = curr.artistId;
                break;
            }
            break;
          }
          default:
            break;
        }

        if (key) {
          acc[key] ??= { totalDuration: 0, totalPrograms: 0 };
          acc[key].totalDuration += curr.duration;
          acc[key].totalPrograms++;
        }

        return acc;
      },
      {} as Record<string, { totalPrograms: number; totalDuration: number }>,
    );
  }, [programs]);

  const showList = useMemo(() => {
    return map(
      uniqBy(
        seq.collect(programs, (program) => {
          if (
            program.type === 'content' &&
            program.subtype === 'episode' &&
            isNonEmptyString(program.showId)
          ) {
            return program;
          }
          return;
        }),
        'showId',
      ),
      (program) => ({ id: program.showId!, title: program.title }),
    );
  }, [programs]);

  const artistList = useMemo(() => {
    return map(
      uniqBy(
        seq.collect(programs, (program) => {
          if (
            program.type === 'content' &&
            program.subtype === 'track' &&
            isNonEmptyString(program.artistId)
          ) {
            return program;
          }
          return;
        }),
        'artistId',
      ),
      (program) => ({ id: program.artistId!, title: program.title }),
    );
  }, [programs]);

  const [removeRequest, setRemoveRequest] = useState<RemoveProgrammingRequest>(
    {},
  );

  const isEmptyRemoveRequest = useMemo(() => {
    return (
      isEmpty(removeRequest) ||
      every(values(removeRequest), (value) => isEmpty(value) || value === false)
    );
  }, [removeRequest]);

  const removeShowsProgramming = () => {
    removeProgramming(removeRequest);
    onClose();
  };

  const getSecondaryText = (id: string) => {
    const details = numAndDurationById[id];
    if (!details) {
      return null;
    }

    return `${details.totalPrograms} ${pluralize(
      'program',
      details.totalPrograms,
    )}, ${betterHumanize(dayjs.duration(details.totalDuration), {
      style: 'short',
    })}`;
  };

  return (
    <Dialog open={open}>
      <DialogTitle>Remove Programming</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Pick specific programming to remove from the channel.
        </DialogContentText>
        <List dense>
          {hasMovies && (
            <ListItem
              secondaryAction={
                <Checkbox
                  edge="end"
                  onChange={(e) => {
                    setRemoveRequest((prev) => ({
                      ...prev,
                      movies: !prev.movies,
                    }));
                    e.target.checked ? increment() : decrement();
                  }}
                  checked={!!removeRequest.movies}
                  inputProps={{ 'aria-labelledby': 'Select Show' }}
                />
              }
            >
              <ListItemText
                primary={'Movies'}
                secondary={getSecondaryText('movies')}
              />
            </ListItem>
          )}
          {map(showList, ({ title, id }) => {
            return (
              <ListItem
                key={id}
                disablePadding
                secondaryAction={
                  <Checkbox
                    edge="end"
                    onChange={(e) => {
                      setRemoveRequest((prev) => ({
                        ...prev,
                        showIds: e.target.checked
                          ? [...(prev.showIds ?? []), id]
                          : reject(prev.showIds, (i) => i === id),
                      }));
                      e.target.checked ? increment() : decrement();
                    }}
                    checked={includes(removeRequest.showIds, id)}
                    inputProps={{ 'aria-labelledby': 'Select Show' }}
                  />
                }
              >
                <ListItemText
                  primary={title}
                  secondary={getSecondaryText(id)}
                />
              </ListItem>
            );
          })}

          {map(artistList, ({ title, id }) => {
            return (
              <ListItem
                key={id}
                disablePadding
                secondaryAction={
                  <Checkbox
                    edge="end"
                    onChange={(e) => {
                      setRemoveRequest((prev) => ({
                        ...prev,
                        artistIds: e.target.checked
                          ? [...(prev.artistIds ?? []), id]
                          : reject(prev.artistIds, (i) => i === id),
                      }));
                      e.target.checked ? increment() : decrement();
                    }}
                    checked={includes(removeRequest.artistIds, id)}
                    inputProps={{ 'aria-labelledby': 'Select Show' }}
                  />
                }
              >
                <ListItemText
                  primary={title}
                  secondary={getSecondaryText(id)}
                />
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
          disabled={isEmptyRemoveRequest}
        >
          {`Remove ${count} ${pluralize('program', count)}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
