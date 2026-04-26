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
import { Trans, useLingui } from '@lingui/react/macro';

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
  const { t } = useLingui();
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
      <DialogTitle><Trans>Block Shuffle</Trans></DialogTitle>
      <DialogContent sx={{ py: 0 }}>
        <DialogContentText sx={{ mb: 1 }}>
          <Trans>Alternate programs in blocks. You can pick the number of programs
          per-type in each block and if the order of shows in each block should
          be randomized.</Trans>
          <br />
        </DialogContentText>
        <DialogContentText variant="body2" component="div">
          <Trans>Grouping works as follows:</Trans>
          <ul>
            <li><Trans>TV shows are grouped by show</Trans></li>
            <li><Trans>Music tracks are grouped by artist</Trans></li>
            <li><Trans>Movies are grouped altogether</Trans></li>
            <li><Trans>Custom show programs are grouped by their parent show</Trans></li>
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
                    label: t`# of Programs`,
                  }}
                />
              </FormControl>
              <FormControl
                sx={{
                  width: ['100%', '50%'],
                }}
              >
                <InputLabel id="sort-block-shuffle-type"><Trans>Type</Trans></InputLabel>
                <Controller
                  control={control}
                  name="shuffleType"
                  render={({ field }) => (
                    <Select
                      {...field}
                      id="sort-block-shuffle-type"
                      label={t`Type`}
                      onChange={(e) => field.onChange(e.target.value)}
                    >
                      <MenuItem value={'Fixed'}><Trans>Fixed</Trans></MenuItem>
                      <MenuItem value={'Random'}><Trans>Random</Trans></MenuItem>
                    </Select>
                  )}
                />
              </FormControl>
            </Stack>
          </Box>
          <Box sx={{ display: isRandom ? 'none' : undefined }}>
            <Stack direction={['column', 'row']} spacing={2} useFlexGap>
              <FormControl sx={{ width: ['100%', '50%'] }}>
                <InputLabel><Trans>Movie Sort</Trans></InputLabel>
                <Controller
                  control={control}
                  name="sortOptions.movies.sort"
                  render={({ field }) => (
                    <Select
                      label={t`Movie Sort`}
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
                          <Trans>Alphabetical</Trans>
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
                          <Trans>Release Date</Trans>
                        </Box>
                      </MenuItem>
                    </Select>
                  )}
                />
              </FormControl>
              <FormControl sx={{ width: ['100%', '50%'] }}>
                <InputLabel><Trans>Movie Sort Order</Trans></InputLabel>
                <Controller
                  control={control}
                  name="sortOptions.movies.order"
                  render={({ field }) => (
                    <Select
                      {...field}
                      label={t`Movie Sort Order`}
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
                          <Trans>Ascending</Trans>
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
                          <Trans>Descending</Trans>
                        </Box>
                      </MenuItem>
                    </Select>
                  )}
                />
              </FormControl>
            </Stack>
            <FormHelperText>
              <Trans>Customize how movie blocks are sorted</Trans>
            </FormHelperText>
          </Box>
          <FormControl fullWidth>
            <FormControlLabel
              control={
                <CheckboxFormController control={control} name="loopBlocks" />
              }
              label={t`Loop Short Programs`}
            />
            <FormHelperText>
              <Trans>If set, any programming group with fewer episodes will be looped
              in order to make perfectly even blocks.</Trans>
            </FormHelperText>
          </FormControl>
          <FormControl fullWidth>
            <FormControlLabel
              control={
                <CheckboxFormController control={control} name="perfectSync" />
              }
              disabled={usePerfectSyncDisabled}
              label={t`Experimental: Make perfect schedule loop`}
            />
            <FormHelperText>
              <Trans>Calculates a schedule where all programs end at the same time,
              creating a perfectly looping schedule.</Trans>
              <br />
              {usePerfectSyncDisabled &&
                t`This option is disabled because it would calculate a schedule that is too long.`}
            </FormHelperText>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()}><Trans>Cancel</Trans></Button>
        <Button
          onClick={() => handleBlockShuffle()}
          startIcon={<ShuffleIcon />}
          variant="contained"
        >
          <Trans>Block Shuffle</Trans>
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddBlockShuffleModal;
