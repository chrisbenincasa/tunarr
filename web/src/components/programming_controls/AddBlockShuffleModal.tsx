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
import { useState } from 'react';
import {
  type BlockShuffleConfig,
  type BlockShufflePreset,
  BlockShufflePresets,
} from '../../hooks/programming_controls/useBlockShuffle';
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
  initialPreset?: BlockShufflePreset;
};

const AddBlockShuffleModalContent = ({
  onClose,
  blockShuffle,
  canUsePerfectSync,
  initialPreset = 'block',
}: Omit<AddBlockShuffleModalProps, 'open'>) => {
  const { t } = useLingui();
  const [preset, setPreset] = useState<BlockShufflePreset>(initialPreset);
  const { control, watch, getValues, reset } = useForm<BlockShuffleConfig>({
    defaultValues: BlockShufflePresets[initialPreset],
  });

  const presetLabels: Record<BlockShufflePreset, string> = {
    block: t`Block Shuffle`,
    cyclic: t`Cyclic Shuffle`,
  };

  const presetDescriptions: Record<BlockShufflePreset, string> = {
    block: t`Shows take turns in a fixed order, each playing a block of episodes before the next show.`,
    cyclic: t`Shows come up at random, one episode at a time. Each show's episodes stay in order, starting from a random episode.`,
  };

  const selectPreset = (next: BlockShufflePreset) => {
    setPreset(next);
    reset(BlockShufflePresets[next]);
  };

  const handleBlockShuffle = () => {
    blockShuffle(getValues());
    onClose();
  };

  const blockSize = watch('blockSize');
  const usePerfectSyncDisabled = !canUsePerfectSync(blockSize);

  const isRandom = watch('shuffleType') === 'Random';
  const isRandomShowOrder = watch('showOrder') === 'random';

  return (
    <>
      <DialogTitle>{presetLabels[preset]}</DialogTitle>
      <DialogContent sx={{ py: 0 }}>
        <FormControl fullWidth sx={{ mt: 1, mb: 2 }}>
          <InputLabel id="sort-block-shuffle-preset">
            <Trans>Preset</Trans>
          </InputLabel>
          <Select
            labelId="sort-block-shuffle-preset"
            label={t`Preset`}
            value={preset}
            onChange={(e) => {
              const value = e.target.value;
              if (value === 'block' || value === 'cyclic') {
                selectPreset(value);
              }
            }}
          >
            <MenuItem value="block">{presetLabels.block}</MenuItem>
            <MenuItem value="cyclic">{presetLabels.cyclic}</MenuItem>
          </Select>
        </FormControl>
        <DialogContentText sx={{ mb: 1 }}>
          {presetDescriptions[preset]}{' '}
          <Trans>You can change any setting below before shuffling.</Trans>
        </DialogContentText>
        <DialogContentText variant="body2" component="div">
          <Trans>Grouping works as follows:</Trans>
          <ul>
            <li>
              <Trans>TV shows are grouped by show</Trans>
            </li>
            <li>
              <Trans>Music tracks are grouped by artist</Trans>
            </li>
            <li>
              <Trans>Movies are grouped altogether</Trans>
            </li>
            <li>
              <Trans>
                Custom show programs are grouped by their parent show
              </Trans>
            </li>
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
                <InputLabel id="sort-block-shuffle-type">
                  <Trans>Episode Order</Trans>
                </InputLabel>
                <Controller
                  control={control}
                  name="shuffleType"
                  render={({ field }) => (
                    <Select
                      {...field}
                      id="sort-block-shuffle-type"
                      label={t`Episode Order`}
                      onChange={(e) => field.onChange(e.target.value)}
                    >
                      <MenuItem value={'Fixed'}>
                        <Trans>In Order</Trans>
                      </MenuItem>
                      <MenuItem value={'Random'}>
                        <Trans>Random</Trans>
                      </MenuItem>
                    </Select>
                  )}
                />
              </FormControl>
            </Stack>
            <Stack
              direction={['column', 'row']}
              spacing={2}
              useFlexGap
              sx={{ mt: 2 }}
            >
              <FormControl sx={{ width: ['100%', '50%'] }}>
                <InputLabel id="sort-block-shuffle-show-order">
                  <Trans>Show Order</Trans>
                </InputLabel>
                <Controller
                  control={control}
                  name="showOrder"
                  render={({ field }) => (
                    <Select
                      {...field}
                      labelId="sort-block-shuffle-show-order"
                      label={t`Show Order`}
                      onChange={(e) => field.onChange(e.target.value)}
                    >
                      <MenuItem value="rotate">
                        <Trans>Take Turns</Trans>
                      </MenuItem>
                      <MenuItem value="random">
                        <Trans>Random</Trans>
                      </MenuItem>
                    </Select>
                  )}
                />
              </FormControl>
              <FormControl
                sx={{
                  width: ['100%', '50%'],
                  display: isRandom ? 'none' : undefined,
                }}
              >
                <InputLabel id="sort-block-shuffle-start-episode">
                  <Trans>Starting Episode</Trans>
                </InputLabel>
                <Controller
                  control={control}
                  name="startEpisode"
                  render={({ field }) => (
                    <Select
                      {...field}
                      labelId="sort-block-shuffle-start-episode"
                      label={t`Starting Episode`}
                      onChange={(e) => field.onChange(e.target.value)}
                    >
                      <MenuItem value="first">
                        <Trans>First Episode</Trans>
                      </MenuItem>
                      <MenuItem value="random">
                        <Trans>Random Episode</Trans>
                      </MenuItem>
                    </Select>
                  )}
                />
              </FormControl>
            </Stack>
            <FormHelperText>
              {isRandomShowOrder ? (
                <Trans>
                  Each next block comes from a random show. Shows with more
                  episodes come up more often unless Loop Short Programs is on.
                </Trans>
              ) : (
                <Trans>Shows take turns in a fixed order.</Trans>
              )}
            </FormHelperText>
          </Box>
          <Box sx={{ display: isRandom ? 'none' : undefined }}>
            <Stack direction={['column', 'row']} spacing={2} useFlexGap>
              <FormControl sx={{ width: ['100%', '50%'] }}>
                <InputLabel>
                  <Trans>Movie Sort</Trans>
                </InputLabel>
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
                <InputLabel>
                  <Trans>Movie Sort Order</Trans>
                </InputLabel>
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
              <Trans>
                If set, any programming group with fewer episodes will be looped
                in order to make perfectly even blocks.
              </Trans>
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
              <Trans>
                Calculates a schedule where all programs end at the same time,
                creating a perfectly looping schedule.
              </Trans>
              <br />
              {usePerfectSyncDisabled &&
                t`This option is disabled because it would calculate a schedule that is too long.`}
            </FormHelperText>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()}>
          <Trans>Cancel</Trans>
        </Button>
        <Button
          onClick={() => handleBlockShuffle()}
          startIcon={<ShuffleIcon />}
          variant="contained"
        >
          <Trans>Shuffle</Trans>
        </Button>
      </DialogActions>
    </>
  );
};

// The content mounts only while the dialog is open, so it does no work when closed.
const AddBlockShuffleModal = ({
  open,
  ...props
}: AddBlockShuffleModalProps) => (
  <Dialog open={open}>
    <AddBlockShuffleModalContent {...props} />
  </Dialog>
);

export default AddBlockShuffleModal;
