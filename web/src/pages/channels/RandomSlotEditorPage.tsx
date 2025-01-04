import { MissingProgramsAlert } from '@/components/slot_scheduler/MissingProgramsAlert.tsx';
import { RandomSlotFormProvider } from '@/components/slot_scheduler/RandomSlotFormProvider.tsx';
import { RandomSlotSettingsForm } from '@/components/slot_scheduler/RandomSlotSettingsForm';
import { RandomSlotTable } from '@/components/slot_scheduler/RandomSlotTable.tsx';
import { useSlotProgramOptions } from '@/hooks/programming_controls/useSlotProgramOptions';
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
import { Link as RouterLink } from '@tanstack/react-router';
import { seq } from '@tunarr/shared/util';
import { RandomSlotSchedule } from '@tunarr/types/api';
import { useToggle } from '@uidotdev/usehooks';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import {
  filter,
  groupBy,
  isNil,
  isUndefined,
  keys,
  mapValues,
  round,
} from 'lodash-es';
import React, { useCallback, useMemo } from 'react';
import { FormProvider, useFieldArray, useForm } from 'react-hook-form';
import Breadcrumbs from '../../components/Breadcrumbs';
import PaddedPaper from '../../components/base/PaddedPaper';
import ChannelProgrammingList from '../../components/channel_config/ChannelProgrammingList';
import UnsavedNavigationAlert from '../../components/settings/UnsavedNavigationAlert';
import { lineupItemAppearsInSchedule } from '../../helpers/slotSchedulerUtil';
import { useUpdateLineup } from '../../hooks/useUpdateLineup';
import { resetLineup } from '../../store/channelEditor/actions';

dayjs.extend(duration);

export type RandomSlotForm = Omit<
  RandomSlotSchedule,
  'timeZoneOffset' | 'type'
>;

const defaultRandomSlotSchedule: RandomSlotSchedule = {
  type: 'random',
  padStyle: 'slot',
  randomDistribution: 'uniform',
  flexPreference: 'distribute',
  maxDays: 365,
  padMs: 1,
  slots: [],
  timeZoneOffset: new Date().getTimezoneOffset(),
  // UI mechanism
  lockWeights: false,
};

export default function RandomSlotEditorPage() {
  const {
    currentEntity: channel,
    programList: newLineup,
    schedule: loadedSchedule,
  } = useChannelEditor();

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
  const { dropdownOpts: programOptions, nameById: programOptionNameById } =
    useSlotProgramOptions();
  const [isCalculatingSlots, toggleIsCalculatingSlots] = useToggle(false);

  const hasExistingTimeSlotSchedule =
    !isNil(loadedSchedule) && loadedSchedule.type === 'time';

  const randomSlotForm = useForm<RandomSlotForm>({
    defaultValues:
      !isUndefined(loadedSchedule) && loadedSchedule.type === 'random'
        ? loadedSchedule
        : defaultRandomSlotSchedule,
  });

  const {
    control,
    getValues,
    formState: { isValid, isDirty },
    reset,
  } = randomSlotForm;

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
    const schedule: RandomSlotSchedule = {
      ...getValues(),
      timeZoneOffset: new Date().getTimezoneOffset(),
      type: 'random',
    };

    // Find programs that have active slots
    const filteredLineup = filter(newLineup, (item) =>
      lineupItemAppearsInSchedule(getValues('slots'), item),
    );

    updateLineupMutation.mutate({
      channelId: channel!.id,
      lineupRequest: {
        type: 'random',
        schedule,
        programs: filteredLineup,
      },
    });
  };

  const programFrequency = useMemo(() => {
    const total = newLineup.length;
    const sums = mapValues(
      groupBy(newLineup, (program) => {
        switch (program.type) {
          case 'content':
            {
              switch (program.subtype) {
                case 'movie':
                  return 'movie';
                case 'episode':
                  return `show.${program.showId}`;
                case 'track':
                  return `artist.${program.artistId}`;
              }
            }
            break;
          case 'custom':
            return `custom-show.${program.customShowId}`;
          case 'flex':
            return 'flex';
          case 'redirect':
            return `redirect.${program.channel}`;
        }
      }),
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

  const onCalculateSlotsEnd = useCallback(() => {
    toggleIsCalculatingSlots(false);
  }, [toggleIsCalculatingSlots]);

  if (isUndefined(channel)) {
    return <div>Loading</div>;
  }

  return (
    <>
      <Breadcrumbs />
      <Stack gap={2} useFlexGap>
        <Typography variant="h4">
          Edit Random Slots (Channel {channel?.number})
        </Typography>
        <MissingProgramsAlert
          slots={slotArray.fields}
          programOptions={programOptions}
        />
        {hasExistingTimeSlotSchedule && (
          <Alert severity="warning">
            This channel has an existing time slot schedule. A channel can only
            use one scheduling type at a time. Saving a schedule here will
            remove the existing time slot schedule.
          </Alert>
        )}
        <PaddedPaper>
          <Stack
            direction="row"
            gap={1}
            sx={{ display: 'flex', alignContent: 'center' }}
          >
            <Typography sx={{ flexGrow: 1, fontWeight: 600 }}>
              Random Slots
            </Typography>
          </Stack>
          <Divider sx={{ my: 2 }} />
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
            <ChannelProgrammingList
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
      <UnsavedNavigationAlert isDirty={isDirty} />
      <Box sx={{ display: 'flex', justifyContent: 'end', pt: 1, columnGap: 1 }}>
        <Box flexGrow={1}>
          <Button
            variant="outlined"
            to=".."
            component={RouterLink}
            startIcon={<ArrowBack />}
            sx={{ justifyContent: 'flex-start' }}
          >
            Back to Programming
          </Button>
        </Box>
        {isDirty && (
          <Button variant="contained" onClick={() => resetLineupToSaved()}>
            Reset Options
          </Button>
        )}
        <Button
          variant="contained"
          disabled={!isValid}
          onClick={() => onSave()}
        >
          Save
        </Button>
      </Box>
    </>
  );
}
