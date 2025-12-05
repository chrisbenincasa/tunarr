import { Save } from '@mui/icons-material';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from '@mui/material';
import { createTypeSearchField } from '@tunarr/shared/util';
import type { Show } from '@tunarr/types';
import { filter, isEmpty, map, reject } from 'lodash-es';
import { useMemo, useState } from 'react';
import type { StrictExtract } from 'ts-essentials';
import type {
  CustomShowProgramOption,
  FillerProgramOption,
  ProgramOptionType,
} from '../../helpers/slotSchedulerUtil.ts';
import { useSlotProgramOptions } from '../../hooks/programming_controls/useSlotProgramOptions.ts';
import { useRandomSlotFormContext } from '../../hooks/useRandomSlotFormContext.ts';
import type { RandomSlotForm, SlotViewModel } from '../../model/SlotModels.ts';
import { defaultRandomSlotSchedule } from '../../model/SlotModels.ts';
import type { CommonDialogProps } from '../../types/CommonDialogProps.ts';
import { ProgramSearchAutocomplete } from '../ProgramSearchAutocomplete.tsx';

type FocusedView = StrictExtract<
  ProgramOptionType,
  'custom-show' | 'filler' | 'show'
>;
type Props = {
  onClose: () => void;
};

const SlotSchedulerCyclicShuffleDialogContent = ({ onClose }: Props) => {
  const { reset } = useRandomSlotFormContext();
  const [searchQueryString, setSearchQueryString] = useState('');
  const enabled = useMemo(
    () => searchQueryString.length >= 1,
    [searchQueryString],
  );
  const [selectedShows, setSelectedShows] = useState<Show[]>([]);
  const [selectedCustomShows, setSelectedCustomShows] = useState<
    CustomShowProgramOption[]
  >([]);
  const [selectedFiller, setSelectedFiller] = useState<FillerProgramOption[]>(
    [],
  );
  const [focusedView, setFocusedView] = useState<FocusedView>('show');
  const programOptions = useSlotProgramOptions();

  const searchQuery = useMemo(
    () => ({
      query: searchQueryString,
      filter: createTypeSearchField('show'),
      restrictSearchTo: ['title'],
    }),
    [searchQueryString],
  );

  const customShowAutoCompleteOpts = useMemo(
    () =>
      focusedView === 'custom-show'
        ? map(
            filter(
              programOptions.dropdownOpts,
              (opt): opt is CustomShowProgramOption =>
                opt.type === 'custom-show',
            ),
            (opt) => ({
              ...opt,
              label: opt.description,
            }),
          )
        : [],
    [programOptions, focusedView],
  );

  const fillerAutoCompleteOpts = useMemo(
    () =>
      programOptions.dropdownOpts
        .filter((opt) => opt.type === 'filler')
        .map((opt) => ({ ...opt, label: opt.description })),
    [programOptions],
  );

  const confirmSchedule = () => {
    const slots: SlotViewModel[] = [];
    for (const show of selectedShows) {
      slots.push({
        type: 'show',
        cooldownMs: 0,
        durationSpec: {
          type: 'dynamic',
          programCount: 2,
        },
        direction: 'asc',
        order: 'next',
        showId: show.uuid,
        show,
        weight: 100,
      });
    }

    for (const cs of selectedCustomShows) {
      slots.push({
        type: 'custom-show',
        cooldownMs: 0,
        durationSpec: {
          type: 'dynamic',
          programCount: 2,
        },
        direction: 'asc',
        order: 'next',
        customShowId: cs.customShowId,
        weight: 100,
        customShow: null,
        isMissing: false,
      });
    }

    for (const f of selectedFiller) {
      slots.push({
        type: 'filler',
        cooldownMs: 0,
        durationSpec: {
          type: 'dynamic',
          programCount: 2,
        },
        order: 'shuffle_prefer_short',
        decayFactor: 0.5,
        durationWeighting: 'linear',
        recoveryFactor: 0.05,
        fillerListId: f.fillerListId,
        weight: 100,
        fillerList: null,
        isMissing: false,
      });
    }

    const newSchedule: RandomSlotForm = {
      ...defaultRandomSlotSchedule,
      padMs: 1,
      randomDistribution: 'uniform',
      slots,
    };

    reset(newSchedule);
    onClose();
  };

  return (
    <>
      <DialogTitle>Configure Cyclic Shuffle</DialogTitle>
      <DialogContent>
        <Stack gap={2}>
          <DialogContentText>
            Cyclic Shuffle randomly shuffles groups of programming.
          </DialogContentText>
          <Box>
            <Stack direction={'row'} spacing={1}>
              {selectedShows.map((show) => (
                <Chip
                  key={show.uuid}
                  label={`Show: ${show.title}`}
                  onDelete={() =>
                    setSelectedShows((prev) =>
                      reject(prev, { uuid: show.uuid }),
                    )
                  }
                />
              ))}
              {selectedCustomShows.map((cs) => (
                <Chip
                  key={`custom-show.${cs.customShowId}`}
                  label={`Custom Show: ${cs.description}`}
                  onDelete={() =>
                    setSelectedCustomShows((prev) =>
                      reject(prev, { customShowId: cs.customShowId }),
                    )
                  }
                />
              ))}
              {selectedFiller.map((cs) => (
                <Chip
                  key={`filler.${cs.fillerListId}`}
                  label={`Filler List: ${cs.description}`}
                  onDelete={() =>
                    setSelectedFiller((prev) =>
                      reject(prev, { fillerListId: cs.fillerListId }),
                    )
                  }
                />
              ))}
            </Stack>
          </Box>
          <FormControl>
            <InputLabel>Type</InputLabel>
            <Select
              value={focusedView}
              label="Type"
              fullWidth
              onChange={(value) =>
                setFocusedView(value.target.value as FocusedView)
              }
            >
              <MenuItem value="show">Show</MenuItem>
              {programOptions.dropdownOpts.some(
                (opt) => opt.type === 'custom-show',
              ) && <MenuItem value="custom-show">Custom Show</MenuItem>}
              {programOptions.dropdownOpts.some(
                (opt) => opt.type === 'filler',
              ) && <MenuItem value="filler">Filler List</MenuItem>}
            </Select>
          </FormControl>
          {focusedView === 'show' && (
            <ProgramSearchAutocomplete
              value={null}
              enabled={enabled}
              includeItem={(result) => result.type === 'show'}
              onChange={(show) => setSelectedShows((prev) => [...prev, show])}
              onQueryChange={setSearchQueryString}
              searchQuery={searchQuery}
              label="Show"
            />
          )}
          {focusedView === 'custom-show' && (
            <Autocomplete<CustomShowProgramOption & { label: string }>
              options={customShowAutoCompleteOpts}
              value={null}
              filterOptions={(opts) =>
                opts.filter(({ customShowId }) =>
                  selectedCustomShows.every(
                    (cs) => cs.customShowId !== customShowId,
                  ),
                )
              }
              onChange={(_, value) =>
                value
                  ? setSelectedCustomShows((prev) => [...prev, value])
                  : void 0
              }
              renderInput={(params) => (
                <TextField {...params} label="Custom Show" />
              )}
            />
          )}
          {focusedView === 'filler' && (
            <Autocomplete<FillerProgramOption & { label: string }>
              disabled={fillerAutoCompleteOpts.length === 0}
              options={fillerAutoCompleteOpts}
              value={null}
              filterOptions={(opts) =>
                opts.filter(({ fillerListId }) =>
                  selectedFiller.every((f) => f.fillerListId !== fillerListId),
                )
              }
              onChange={(_, value) =>
                value ? setSelectedFiller((prev) => [...prev, value]) : void 0
              }
              renderInput={(params) => <TextField {...params} label="Filler" />}
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()}>Cancel</Button>
        <Button
          startIcon={<Save />}
          variant="contained"
          disabled={[selectedShows, selectedFiller, selectedCustomShows].every(
            isEmpty,
          )}
          onClick={() => confirmSchedule()}
        >
          Save
        </Button>
      </DialogActions>
    </>
  );
};

export const SlotSchedulerCyclicShuffleDialog = ({
  open,
  onClose,
}: CommonDialogProps) => {
  return (
    <Dialog open={open} onClose={onClose} keepMounted={false}>
      <SlotSchedulerCyclicShuffleDialogContent onClose={onClose} />
    </Dialog>
  );
};
