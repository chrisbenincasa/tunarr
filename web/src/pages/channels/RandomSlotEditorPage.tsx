import { RandomSlotFormProvider } from '@/components/slot_scheduler/RandomSlotFormProvider.tsx';
import { RandomSlotSettingsForm } from '@/components/slot_scheduler/RandomSlotSettingsForm';
import { RandomSlotTable } from '@/components/slot_scheduler/RandomSlotTable.tsx';
import { useSlotProgramOptions } from '@/hooks/programming_controls/useSlotProgramOptions';
import { defaultRandomSlotSchedule } from '@/model/SlotModels.ts';
import { useChannelEditor } from '@/store/selectors';
import { ArrowBack, HelpOutline } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Divider,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { seq } from '@tunarr/shared/util';
import type { RandomSlotSchedule } from '@tunarr/types/api';
import { useToggle } from '@uidotdev/usehooks';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import {
  filter,
  groupBy,
  isUndefined,
  keys,
  mapValues,
  orderBy,
  round,
  sum,
} from 'lodash-es';
import React, { useCallback, useMemo, useState } from 'react';
import { FormProvider, useFieldArray, useForm } from 'react-hook-form';
import Breadcrumbs from '../../components/Breadcrumbs';
import PaddedPaper from '../../components/base/PaddedPaper';
import { RouterButtonLink } from '../../components/base/RouterButtonLink.tsx';
import ChannelLineupList from '../../components/channel_config/ChannelLineupList.tsx';
import UnsavedNavigationAlert from '../../components/settings/UnsavedNavigationAlert';
import { SlotProgrammingOptionsProvider } from '../../components/slot_scheduler/SlotProgrammingOptionsProvider.tsx';
import { getProgramGroupingKey } from '../../helpers/programUtil.ts';
import { lineupItemAppearsInSchedule } from '../../helpers/slotSchedulerUtil';
import { useChannelSchedule } from '../../hooks/useChannelSchedule.ts';
import { useUpdateLineup } from '../../hooks/useUpdateLineup';
import type { RandomSlotForm } from '../../model/SlotModels.ts';
import { resetLineup } from '../../store/channelEditor/actions';
import type { Maybe } from '../../types/util.ts';

dayjs.extend(duration);

export default function RandomSlotEditorPage() {
  const { currentEntity: channel, programList: newLineup } = useChannelEditor();
  const { data: channelSchedule } = useChannelSchedule(channel!.id);

  const updateLineupMutation = useUpdateLineup({
    onSuccess(data) {
      reset(data.schedule ?? defaultRandomSlotSchedule, {
        keepDefaultValues: false,
        keepDirty: false,
      });
    },
  });

  const theme = useTheme();
  const smallViewport = useMediaQuery(theme.breakpoints.down('sm'));
  const { nameById: programOptionNameById } = useSlotProgramOptions();
  const [isCalculatingSlots, toggleIsCalculatingSlots] = useToggle(false);
  const [randomState, setRandomState] =
    useState<Maybe<{ seed?: number[]; discardCount?: number }>>();

  const hasExistingTimeSlotSchedule = channelSchedule.schedule?.type === 'time';

  const randomSlotForm = useForm<RandomSlotForm>({
    defaultValues:
      channelSchedule.schedule?.type === 'random'
        ? {
            ...channelSchedule.schedule,
            slots: orderBy(
              channelSchedule.schedule.slots,
              (slot, idx) => slot.index ?? idx,
              'asc',
            ),
            lockWeights:
              channelSchedule.schedule.randomDistribution !== 'weighted'
                ? false
                : sum(
                    channelSchedule.schedule.slots.map((slot) => slot.weight),
                  ) > 100,
          }
        : defaultRandomSlotSchedule,
  });

  const { control, getValues, formState, reset } = randomSlotForm;
  const { isDirty } = formState;

  const slotArray = useFieldArray({
    control,
    name: 'slots',
    rules: {
      required: true,
    },
  });

  const resetLineupToSaved = useCallback(() => {
    resetLineup();
    reset();
  }, [reset]);

  const onSave = () => {
    const value = getValues();
    const schedule: RandomSlotSchedule = {
      ...value,
      // Index is controlled by the field array functions
      slots: value.slots.map((slot, idx) => ({ ...slot, index: idx })),
      timeZoneOffset: new Date().getTimezoneOffset(),
      type: 'random',
    };

    // Find programs that have active slots
    const filteredLineup = filter(newLineup, (item) =>
      lineupItemAppearsInSchedule(getValues('slots'), item),
    );

    updateLineupMutation.mutate({
      path: {
        id: channel!.id,
      },
      body: {
        type: 'random',
        schedule,
        programs: filteredLineup,
        seed: randomState?.seed,
        discardCount: randomState?.discardCount,
      },
    });
  };

  const programFrequency = useMemo(() => {
    const total = newLineup.length;
    const sums = mapValues(
      groupBy(newLineup, getProgramGroupingKey),
      (group) => group.length,
    );

    return seq.collect(keys(sums), (key) => {
      const name = programOptionNameById[key];
      if (!name) {
        return;
      }

      return (
        <React.Fragment key={key}>
          <span key={key}>
            {name}: {round((sums[key] / total) * 100, 2)}%
          </span>
          <br />
        </React.Fragment>
      );
    });
  }, [newLineup, programOptionNameById]);

  const onCalculateSlotsEnd = useCallback(
    (state?: { seed?: number[]; discardCount?: number }) => {
      setRandomState(state);
      toggleIsCalculatingSlots(false);
    },
    [toggleIsCalculatingSlots],
  );

  if (isUndefined(channel)) {
    return <div>Loading</div>;
  }

  return (
    <>
      <Breadcrumbs />
      <Stack gap={2} useFlexGap>
        <Typography variant="h4">Slot Scheduler</Typography>
        {hasExistingTimeSlotSchedule && (
          <Alert severity="warning">
            This channel has an existing time slot schedule. A channel can only
            use one scheduling type at a time. Saving a schedule here will
            remove the existing time slot schedule.
          </Alert>
        )}
        <PaddedPaper>
          <Typography sx={{ flexGrow: 1, fontWeight: 600 }}>Slots</Typography>
          <Divider sx={{ my: 2 }} />
          <SlotProgrammingOptionsProvider>
            <RandomSlotFormProvider {...randomSlotForm} slotArray={slotArray}>
              <RandomSlotTable />
            </RandomSlotFormProvider>
            <Divider sx={{ my: 2 }} />
            <FormProvider {...randomSlotForm}>
              <RandomSlotSettingsForm
                onCalculateStart={() => toggleIsCalculatingSlots(true)}
                onCalculateEnd={onCalculateSlotsEnd}
              />
            </FormProvider>
          </SlotProgrammingOptionsProvider>
        </PaddedPaper>
        <PaddedPaper>
          <Stack direction="row" sx={{ width: '100%' }}>
            <Typography sx={{ pb: 1 }}>Programming Preview</Typography>
            <Typography sx={{ ml: 'auto' }}>
              <Tooltip title={<>{programFrequency}</>} placement="left">
                <HelpOutline />
              </Tooltip>
            </Typography>
          </Stack>
          <Divider />
          <Box sx={{ minHeight: 400 }}>
            <ChannelLineupList
              type="selector"
              enableDnd={false}
              enableRowDelete={false}
              enableRowEdit={false}
              listEmptyMessage={
                isCalculatingSlots ? 'Calculating Slots...' : null
              }
              virtualListProps={{
                width: '100%',
                height: 400,
                itemSize: smallViewport ? 70 : 35,
                overscanCount: 5,
              }}
            />
          </Box>
        </PaddedPaper>
      </Stack>
      <UnsavedNavigationAlert
        isDirty={isDirty}
        onProceed={resetLineupToSaved}
      />
      <Box sx={{ display: 'flex', justifyContent: 'end', pt: 1, columnGap: 1 }}>
        <Box flexGrow={1}>
          <RouterButtonLink
            variant="outlined"
            to=".."
            startIcon={<ArrowBack />}
            sx={{ justifyContent: 'flex-start' }}
          >
            Back to Programming
          </RouterButtonLink>
        </Box>
        {isDirty && (
          <Button variant="contained" onClick={() => resetLineupToSaved()}>
            Reset Options
          </Button>
        )}
        <Button variant="contained" onClick={() => onSave()}>
          Save
        </Button>
      </Box>
    </>
  );
}
