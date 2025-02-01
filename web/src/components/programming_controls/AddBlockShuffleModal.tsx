import {
  ArrowDownward,
  ArrowUpward,
  Widgets as ShuffleIcon,
  SortByAlpha,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Stack,
} from '@mui/material';
import { CalendarIcon } from '@mui/x-date-pickers';
import { Controller, useForm } from 'react-hook-form';
import { type BlockShuffleConfig } from '../../hooks/programming_controls/useBlockShuffle';
import {
  CheckboxFormController,
  NumericFormControllerText,
} from '../util/TypedController.tsx';

type AddBlockShuffleModalProps = {
  open: boolean;
  onClose: () => void;
  // Kinda gnarly but we have to pass these
  // down for now
  blockShuffle: (opts: BlockShuffleConfig | null) => void;
  canUsePerfectSync: (size: number) => boolean;
};

const AddBlockShuffleModal = ({
  open,
  onClose,
  blockShuffle,
  canUsePerfectSync,
}: AddBlockShuffleModalProps) => {
  const { control, watch, getValues } = useForm<BlockShuffleConfig>({
    defaultValues: {
      shuffleType: 'Fixed',
      blockSize: 2,
      sortOptions: {
        movies: {
          sort: 'release_date',
          order: 'asc',
        },
        show: {
          order: 'asc',
        },
      },
      loopBlocks: true,
      perfectSync: false,
    },
  });

  const handleBlockShuffle = () => {
    blockShuffle(getValues());
    onClose();
  };

  const blockSize = watch('blockSize');
  const usePerfectSyncDisabled = !canUsePerfectSync(blockSize);

  const isRandom = watch('shuffleType') === 'Random';

  return (
    <Dialog open={open}>
      <DialogTitle>Block Shuffle</DialogTitle>
      <DialogContent sx={{ py: 0 }}>
        <DialogContentText sx={{ mb: 1 }}>
          Alternate programs in blocks. You can pick the number of programs
          per-type in each block and if the order of shows in each block should
          be randomized.
          <br />
        </DialogContentText>
        <DialogContentText variant="body2" component="div">
          Grouping works as follows:
          <ul>
            <li>TV shows are grouped by show</li>
            <li>Music tracks are grouped by artist</li>
            <li>Movies are grouped altogether</li>
            <li>Custom show programs are grouped by their parent show</li>
          </ul>
        </DialogContentText>
        <Stack spacing={2} sx={{ my: 2 }} divider={<Divider />}>
          <Box>
            <Stack direction={['column', 'row']} spacing={2} useFlexGap>
              <FormControl sx={{ width: ['100%', '50%'] }}>
                <NumericFormControllerText
                  control={control}
                  name="blockSize"
                  TextFieldProps={{
                    label: '# of Programs',
                  }}
                />
              </FormControl>
              <FormControl
                sx={{
                  width: ['100%', '50%'],
                }}
              >
                <InputLabel id="sort-block-shuffle-type">Type</InputLabel>
                <Controller
                  control={control}
                  name="shuffleType"
                  render={({ field }) => (
                    <Select
                      {...field}
                      id="sort-block-shuffle-type"
                      label="Type"
                      onChange={(e) => field.onChange(e.target.value)}
                    >
                      <MenuItem value={'Fixed'}>Fixed</MenuItem>
                      <MenuItem value={'Random'}>Random</MenuItem>
                    </Select>
                  )}
                />
              </FormControl>
            </Stack>
          </Box>
          <Box sx={{ display: isRandom ? 'none' : undefined }}>
            <Stack direction={['column', 'row']} spacing={2} useFlexGap>
              <FormControl sx={{ width: ['100%', '50%'] }}>
                <InputLabel>Movie Sort</InputLabel>
                <Controller
                  control={control}
                  name="sortOptions.movies.sort"
                  render={({ field }) => (
                    <Select
                      label="Movie Sort"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value)}
                    >
                      <MenuItem value="alpha">
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <SortByAlpha sx={{ height: 23, mr: 1 }} />
                          Alphabetical
                        </Box>
                      </MenuItem>
                      <MenuItem value="release_date">
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <CalendarIcon sx={{ height: 23, mr: 1 }} />
                          Release Date
                        </Box>
                      </MenuItem>
                    </Select>
                  )}
                />
              </FormControl>
              <FormControl sx={{ width: ['100%', '50%'] }}>
                <InputLabel>Movie Sort Order</InputLabel>
                <Controller
                  control={control}
                  name="sortOptions.movies.order"
                  render={({ field }) => (
                    <Select
                      {...field}
                      label="Movie Sort Order"
                      onChange={(e) => field.onChange(e.target.value)}
                    >
                      <MenuItem value="asc">
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <ArrowUpward sx={{ height: 23, mr: 1 }} />
                          Ascending
                        </Box>
                      </MenuItem>
                      <MenuItem value="desc">
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <ArrowDownward sx={{ height: 23, mr: 1 }} />
                          Descending
                        </Box>
                      </MenuItem>
                    </Select>
                  )}
                />
              </FormControl>
            </Stack>
            <FormHelperText>
              Customize how movie blocks are sorted
            </FormHelperText>
          </Box>
          <FormControl fullWidth>
            <FormControlLabel
              control={
                <CheckboxFormController control={control} name="loopBlocks" />
              }
              label="Loop Short Programs"
            />
            <FormHelperText>
              If set, any programming group with fewer episodes will be looped
              in order to make perfectly even blocks.
            </FormHelperText>
          </FormControl>
          <FormControl fullWidth>
            <FormControlLabel
              control={
                <CheckboxFormController control={control} name="perfectSync" />
              }
              disabled={usePerfectSyncDisabled}
              label="Experimental: Make perfect schedule loop"
            />
            <FormHelperText>
              Calculates a schedule where all programs end at the same time,
              creating a perfectly looping schedule.
              <br />
              {usePerfectSyncDisabled &&
                'This option is disabled because it would calculate a schedule that is too long.'}
            </FormHelperText>
          </FormControl>
        </Stack>
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
