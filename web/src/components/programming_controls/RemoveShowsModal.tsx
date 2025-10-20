import { betterHumanize } from '@/helpers/dayjs';
import { isNonEmptyString } from '@/helpers/util';
import {
  Autocomplete,
  Box,
  Checkbox,
  Chip,
  DialogContentText,
  List,
  ListItem,
  ListItemText,
  TextField,
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
  identity,
  includes,
  isEmpty,
  map,
  reduce,
  some,
  uniqBy,
  values,
} from 'lodash-es';
import pluralize from 'pluralize';
import type { HTMLAttributes } from 'react';
import { useMemo, useState } from 'react';
import { match, P } from 'ts-pattern';
import { useCounter } from 'usehooks-ts';
import type { RemoveProgrammingRequest } from '../../hooks/programming_controls/useRemoveProgramming';
import { useRemoveProgramming } from '../../hooks/programming_controls/useRemoveProgramming';
import useStore from '../../store';
import { materializedProgramListSelector } from '../../store/selectors';

type RemoveShowsModalProps = {
  open: boolean;
  onClose: () => void;
};

interface FilmOptionType {
  id: string;
  title: string;
  firstLetter?: string;
}

export const RemoveShowsModal = ({ open, onClose }: RemoveShowsModalProps) => {
  const { count, increment, decrement } = useCounter(0);
  const removeProgramming = useRemoveProgramming();
  const [removeRequest, setRemoveRequest] = useState<RemoveProgrammingRequest>(
    {},
  );
  const programs = useStore(materializedProgramListSelector);
  const hasMovies = useMemo(() => {
    return some(programs, (p) => p.type === 'content' && p.subtype === 'movie');
  }, [programs]);

  const numAndDurationById = useMemo(() => {
    return reduce(
      programs,
      (acc, curr) => {
        const key = match(curr)
          .with(
            {
              type: 'content',
              subtype: P.select(P.union('movie', 'music_video', 'other_video')),
            },
            identity,
          )
          .with({ type: 'content', subtype: 'episode' }, (curr) => curr.showId)
          .with({ type: 'content', subtype: 'track' }, (curr) => curr.artistId)
          .with({ type: P._ }, () => undefined)
          .exhaustive();

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

  // Get the total number of movies from the memoized object
  const movieCount = numAndDurationById['movie']?.totalPrograms ?? 0;

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
      (program) => ({
        id: program.showId!,
        title: program.grandparent?.title ?? program.title,
      }),
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
      (program) => ({
        id: program.artistId!,
        title: program.grandparent?.title ?? program.title,
      }),
    );
  }, [programs]);

  const mapListToGroupedOptions = (
    list: Array<{ id: string; title: string }>,
  ) => {
    return list.map((option) => {
      // Get the first letter, use a placeholder if title is empty.
      const firstLetter = (option.title?.[0] ?? '-').toUpperCase();

      return {
        // Group numbers/digits under '0-9', otherwise use the first letter.
        firstLetter: /[0-9]/.test(firstLetter) ? '0-9' : firstLetter,
        ...option,
      };
    });
  };

  const showOptions = useMemo(
    () => mapListToGroupedOptions(showList),
    [showList],
  );

  const artistOptions = useMemo(
    () => mapListToGroupedOptions(artistList),
    [artistList],
  );

  const isEmptyRemoveRequest = useMemo(() => {
    return (
      isEmpty(removeRequest) ??
      every(values(removeRequest), (value) => {
        // If it's a boolean (movies: true/false), only check if it's the 'empty' state (false).
        // We do this because lodash treats booleans as empty regardless of value
        if (typeof value === 'boolean') {
          return value === false;
        }

        // Otherwise, check if the value is empty.
        return isEmpty(value);
      })
    );
  }, [removeRequest]);

  const removeShowsProgramming = () => {
    removeProgramming(removeRequest);
    onClose();
  };

  const getProgramCounts = (id: string, type?: string) => {
    const details = numAndDurationById[id];
    if (!details) {
      return null;
    }

    return `${details.totalPrograms} ${pluralize(
      type ?? 'program',
      details.totalPrograms,
    )}, ${betterHumanize(dayjs.duration(details.totalDuration), {
      style: 'short',
    })}`;
  };

  const getArtistIds = (options: FilmOptionType[]) => map(options, 'id');

  return (
    <>
      <Dialog open={open} scroll={'paper'}>
        <DialogTitle>Remove Programming</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Pick specific programming to remove from the channel.
          </DialogContentText>

          <Autocomplete
            options={showOptions.sort(
              (a, b) => -b.firstLetter.localeCompare(a.firstLetter),
            )}
            groupBy={(option: FilmOptionType) => option.firstLetter ?? '-'}
            getOptionLabel={(option: FilmOptionType) => option.title}
            openOnFocus
            sx={{ my: 2, flex: 1 }}
            autoComplete
            includeInputInList
            multiple={true}
            getOptionDisabled={(option) => {
              const selectedIds = removeRequest.showIds ?? [];
              return includes(selectedIds, option.id);
            }}
            onChange={(_, newOptions) => {
              // Extract the IDs from the selected options
              const newShowIds = map(newOptions, 'id');

              setRemoveRequest((prev) => ({
                ...prev,
                showIds: newShowIds,
              }));

              // Update the program counter based on the number of selected shows
              const countDifference =
                newShowIds.length - (removeRequest.showIds?.length ?? 0);
              if (countDifference > 0) {
                for (let i = 0; i < countDifference; i++) increment();
              } else if (countDifference < 0) {
                for (let i = 0; i < Math.abs(countDifference); i++) decrement();
              }
            }}
            value={
              removeRequest.showIds
                ? showList.filter((show) =>
                    (removeRequest.showIds ?? []).includes(show.id),
                  )
                : []
            }
            renderInput={(params) => (
              <TextField {...params} label="Select Shows to Remove" />
            )}
            renderOption={(
              props: HTMLAttributes<HTMLLIElement>,
              option: FilmOptionType,
            ) => {
              const { ...optionProps } = props;
              return (
                <Box
                  key={option.id}
                  component="li"
                  sx={{
                    width: '100%',
                    flexDirection: ['column', 'row'],
                  }}
                  {...optionProps}
                >
                  <div
                    style={{
                      textAlign: 'left',
                      width: '100%',
                    }}
                  >
                    {option.title}
                  </div>
                  <Chip
                    label={getProgramCounts(option.id, 'episode')}
                    size="small"
                    sx={{ width: '100%' }}
                  />
                </Box>
              );
            }}
          />

          {artistList.length > 0 && (
            <Autocomplete
              options={artistOptions.sort(
                (a, b) => -b.firstLetter.localeCompare(a.firstLetter),
              )}
              groupBy={(option: FilmOptionType) => option.firstLetter ?? '-'}
              getOptionLabel={(option: FilmOptionType) => option.title}
              openOnFocus
              sx={{ my: 2, flex: 1 }}
              autoComplete
              includeInputInList
              multiple={true}
              getOptionDisabled={(option) => {
                const selectedIds = removeRequest.artistIds ?? [];
                return includes(selectedIds, option.id);
              }}
              value={
                removeRequest.artistIds
                  ? artistList.filter((artist) =>
                      (removeRequest.artistIds ?? []).includes(artist.id),
                    )
                  : []
              }
              onChange={(_, newOptions) => {
                const newArtistIds = getArtistIds(newOptions);
                const previousArtistIds = removeRequest.artistIds ?? [];

                setRemoveRequest((prev) => ({
                  ...prev,
                  artistIds: newArtistIds,
                }));

                // Update the program counter based on the number of selected shows
                const countDifference =
                  newArtistIds.length - previousArtistIds.length;

                if (countDifference > 0) {
                  for (let i = 0; i < countDifference; i++) increment();
                } else if (countDifference < 0) {
                  for (let i = 0; i < Math.abs(countDifference); i++)
                    decrement();
                }
              }}
              renderInput={(params) => (
                <TextField {...params} label="Select Artists to Remove" />
              )}
              renderOption={(
                props: HTMLAttributes<HTMLLIElement>,
                option: FilmOptionType,
              ) => {
                const { ...optionProps } = props;
                return (
                  <Box
                    key={option.id}
                    component="li"
                    sx={{
                      width: '100%',
                      flexDirection: ['column', 'row'],
                    }}
                    {...optionProps}
                  >
                    <div
                      style={{
                        textAlign: 'left',
                        width: '100%',
                      }}
                    >
                      {option.title}
                    </div>
                    <Chip
                      label={getProgramCounts(option.id, 'track')}
                      size="small"
                      sx={{ width: '100%' }}
                    />
                  </Box>
                );
              }}
            />
          )}

          <Box key="dynamic-list-container">
            <List dense>
              {hasMovies && (
                <ListItem
                  secondaryAction={
                    <Checkbox
                      edge="end"
                      onChange={(e) => {
                        const isChecked = e.target.checked;

                        setRemoveRequest((prev) => {
                          const newState = {
                            ...prev,
                            movies: isChecked,
                          };
                          return newState;
                        });

                        const countDelta = isChecked ? movieCount : -movieCount;
                        for (let i = 0; i < Math.abs(countDelta); i++) {
                          if (countDelta > 0) increment();
                          else decrement();
                        }
                      }}
                      checked={!!removeRequest.movies}
                    />
                  }
                >
                  <ListItemText
                    primary={`Remove All ${movieCount} ${pluralize('Movie', movieCount)}`}
                    secondary={getProgramCounts('movies')}
                  />
                </ListItem>
              )}
            </List>
          </Box>
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
    </>
  );
};
