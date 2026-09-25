import type {
  CustomShowProgramOption,
  FillerProgramOption,
} from '@/helpers/slotSchedulerUtil';
import {
  isSelectableForNewSlot,
  OneDayMillis,
} from '@/helpers/slotSchedulerUtil';
import type { TimeSlotViewModel } from '@/model/TimeSlotModels.ts';
import { Trans, useLingui } from '@lingui/react/macro';
import {
  Box,
  Button,
  DialogActions,
  DialogContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
} from '@mui/material';
import { TimePicker } from '@mui/x-date-pickers';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { isNil, map, values } from 'lodash-es';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { match } from 'ts-pattern';
import { v4 } from 'uuid';
import { deriveMidRollDefaults } from '../../helpers/midRollDefaults.ts';
import { useSlotProgramOptionsContext } from '../../hooks/programming_controls/useSlotProgramOptions.ts';
import { useTimeSlotFormContext } from '../../hooks/slot_scheduler/useTimeSlotFormContext.ts';
import { useFillerLists } from '../../hooks/useFillerLists.ts';
import useStore from '../../store/index.ts';
import { slotIsLinkable, type LinkMode } from '../../model/CommonSlotModels.ts';
import { TabPanel } from '../TabPanel.tsx';
import { EditSlotProgrammingForm } from './EditSlotProgrammingForm.tsx';
import { MidRollConfigPanel } from './MidRollConfigPanel.tsx';
import { SlotFillerDialogPanel } from './SlotFillerDialogPanel.tsx';
import { TimeSlotConfigDialogPanel } from './TimeSlotConfigDialogPanel.tsx';

const DaysOfWeekMenuItems = [
  { value: 0, name: 'Sunday' },
  { value: 1, name: 'Monday' },
  { value: 2, name: 'Tuesday' },
  { value: 3, name: 'Wednesday' },
  { value: 4, name: 'Thursday' },
  { value: 5, name: 'Friday' },
  { value: 6, name: 'Saturday' },
];

type EditTimeSlotDialogContentProps = {
  slot: TimeSlotViewModel;
  onSave: (slot: TimeSlotViewModel) => void;
  onCancel: () => void;
  onClose?: () => void;
};

export const EditTimeSlotDialogContent = ({
  slot,
  onSave,
  onCancel,
  onClose,
}: EditTimeSlotDialogContentProps) => {
  const { t } = useLingui();
  const {
    getValues: getSlotFormValues,
    setValue: setSlotFormValue,
    slotArray,
    watch: watchParent,
  } = useTimeSlotFormContext();
  const currentPeriod = getSlotFormValues('period');
  const allSlots = watchParent('slots');
  const linkableSlots = useMemo(
    () => allSlots.filter(slotIsLinkable),
    [allSlots],
  );

  const handleLinkSourceSlot = useCallback(
    (sourceSlotId: string, groupId: string, linkMode: LinkMode) => {
      const slots = getSlotFormValues('slots');
      const idx = slots.findIndex(
        (s) => slotIsLinkable(s) && s.id === sourceSlotId,
      );
      if (idx !== -1) {
        const field = slots[idx];
        if (slotIsLinkable(field)) {
          slotArray.update(idx, {
            ...field,
            iterationGroup: groupId,
            linkMode,
          });
        }
      }
    },
    [slotArray, getSlotFormValues],
  );

  const handleUnlinkFromGroup = useCallback(
    (groupId: string) => {
      const currentSlotId = slotIsLinkable(slot) ? slot.id : undefined;
      const slots = getSlotFormValues('slots');
      const peersInGroup = slots.filter(
        (s) =>
          slotIsLinkable(s) &&
          s.iterationGroup === groupId &&
          s.id !== currentSlotId,
      );
      if (peersInGroup.length <= 1) {
        const newSlots = slots.map((s) => {
          if (
            slotIsLinkable(s) &&
            s.iterationGroup === groupId &&
            s.id !== currentSlotId
          ) {
            return {
              ...s,
              iterationGroup: undefined,
              linkMode: undefined,
              rerunOverflow: undefined,
            };
          }
          return s;
        });
        setSlotFormValue('slots', newSlots, {
          shouldDirty: true,
          shouldTouch: true,
        });
      }
    },
    [getSlotFormValues, setSlotFormValue, slot],
  );

  const { data: fillerLists } = useFillerLists();
  const programOptions = useSlotProgramOptionsContext();
  const programLookup = useStore((s) => s.programLookup);
  const channelPrograms = useMemo(() => values(programLookup), [programLookup]);

  const formMethods = useForm<TimeSlotViewModel>({
    defaultValues: slot,
    reValidateMode: 'onChange',
  });

  const {
    control,
    getValues,
    formState: { isValid, isSubmitting },
  } = formMethods;

  const updateSlotDay = useCallback(
    (newDayOfWeek: number, originalOnChange: (...args: unknown[]) => void) => {
      const startTimeOfDay = getValues('startTime') % OneDayMillis;
      const newStartTime = startTimeOfDay + newDayOfWeek * OneDayMillis;
      originalOnChange(newStartTime);
    },
    [getValues],
  );

  const updateSlotTime = useCallback(
    (
      fieldValue: Dayjs | null,
      originalOnChange: (...args: unknown[]) => void,
    ) => {
      if (!fieldValue) return;
      const h = fieldValue.hour();
      const m = fieldValue.minute();
      const multiplier = Math.floor(getValues('startTime') / OneDayMillis);
      const millis = dayjs.duration({ hours: h, minutes: m }).asMilliseconds();
      originalOnChange(millis + multiplier * OneDayMillis);
    },
    [getValues],
  );

  const slotType = formMethods.watch('type');
  const fillerValues = formMethods.watch('filler' as never) as
    | { types?: string[] }[]
    | undefined;
  const hasMidFiller =
    fillerValues?.some((f) => f.types?.includes('mid')) ?? false;
  const [tab, setTab] = useState(0);

  useEffect(() => {
    if (!hasMidFiller && tab === 3) {
      setTab(0);
    }
    if (hasMidFiller && !formMethods.getValues('midRoll')) {
      formMethods.setValue(
        'midRoll',
        deriveMidRollDefaults(formMethods.getValues(), channelPrograms),
      );
    }
  }, [hasMidFiller, tab, formMethods, channelPrograms]);

  const newSlotForType = useCallback(
    (type: TimeSlotViewModel['type']) => {
      const startTime = getValues('startTime');
      return match(type)
        .returnType<TimeSlotViewModel>()
        .with('custom-show', () => {
          const opt = programOptions
            .filter(isSelectableForNewSlot)
            .find(
              (opt): opt is CustomShowProgramOption =>
                opt.type === 'custom-show',
            );
          if (opt === undefined) {
            throw new Error(
              'Custom show slots are only offered when a custom show has programs',
            );
          }
          return {
            id: v4(),
            startTime,
            type: 'custom-show',
            order: 'next',
            direction: 'asc',
            customShowId: opt.customShowId,
            title: opt.description,
            customShow: null,
            isMissing: false,
          };
        })
        .with('movie', () => ({
          id: v4(),
          startTime,
          type: 'movie',
          order: 'alphanumeric',
          direction: 'asc',
          title: 'Movies',
        }))
        .with('filler', () => {
          const opt = programOptions.find(
            (opt): opt is FillerProgramOption => opt.type === 'filler',
          );
          return {
            id: v4(),
            type: 'filler',
            order: 'shuffle_prefer_short',
            decayFactor: 0.5,
            durationWeighting: 'linear',
            recoveryFactor: 0.05,
            fillerListId: opt?.value ?? '',
            startTime,
            fillerList: null,
            isMissing: false,
          };
        })
        .with('flex', () => ({
          type: 'flex',
          startTime,
        }))
        .with('redirect', () => {
          const opt = programOptions.find((opt) => opt.type === 'redirect');
          return {
            startTime,
            type: 'redirect',
            channelId: opt?.channelId ?? '',
            order: 'next',
            direction: 'asc',
            title: `Redirect to Channel ${opt?.channelName ?? ''}`,
          };
        })
        .with('show', () => {
          const opt = programOptions.find((opt) => opt.type === 'show');
          return {
            id: v4(),
            startTime,
            type: 'show' as const,
            showId: opt?.showId ?? '',
            order: 'next',
            direction: 'asc',
            title: opt?.description ?? '',
            show: null,
            seasonFilter: [],
            seasonExcludeFilter: [],
          };
        })
        .with('smart-collection', () => {
          const opt = programOptions.find(
            (opt) => opt.type === 'smart-collection',
          );
          return {
            id: v4(),
            startTime,
            type: 'smart-collection' as const,
            order: 'next',
            direction: 'asc',
            smartCollectionId: opt?.collectionId ?? '',
            smartCollection: null,
            isMissing: false,
          };
        })
        .exhaustive();
    },
    [getValues, programOptions],
  );

  const cancel = useCallback(() => {
    onCancel();
    onClose?.();
  }, [onCancel, onClose]);

  const commit = useCallback(() => {
    onSave(getValues());
    onClose?.();
  }, [onSave, getValues, onClose]);

  return (
    <>
      <DialogContent>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <Tabs
            value={tab}
            onChange={(_, tab: number) => setTab(tab)}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label={t`Programming`} value={0} />
            <Tab
              label={t`Filler`}
              value={1}
              disabled={slotType === 'flex' || fillerLists.length === 0}
            />
            <Tab label={t`Config`} value={2} />
            {hasMidFiller && <Tab label={t`Mid-Roll`} value={3} />}
          </Tabs>
          <FormProvider {...formMethods}>
            <TabPanel value={tab} index={0}>
              <Stack gap={2} useFlexGap>
                <Stack direction="row" gap={1}>
                  {currentPeriod === 'week' && (
                    <FormControl fullWidth>
                      <InputLabel>{t`Day`}</InputLabel>
                      <Controller
                        control={control}
                        name={`startTime`}
                        render={({ field }) => (
                          <Select
                            {...field}
                            fullWidth
                            value={Math.floor(field.value / OneDayMillis)}
                            label={t`Day`}
                            onChange={(e) =>
                              updateSlotDay(
                                e.target.value as number,
                                field.onChange,
                              )
                            }
                          >
                            {map(DaysOfWeekMenuItems, ({ value, name }) => (
                              <MenuItem key={value} value={value}>
                                {name}
                              </MenuItem>
                            ))}
                          </Select>
                        )}
                      />
                    </FormControl>
                  )}
                  <Controller
                    control={control}
                    name={`startTime`}
                    render={({ field, fieldState: { error } }) => {
                      return (
                        <TimePicker
                          reduceAnimations
                          {...field}
                          value={dayjs()
                            .startOf(currentPeriod)
                            .add(field.value)}
                          onChange={(value) =>
                            updateSlotTime(value, field.onChange)
                          }
                          label={t`Start Time`}
                          closeOnSelect={false}
                          slotProps={{
                            textField: {
                              error: !isNil(error),
                            },
                          }}
                        />
                      );
                    }}
                  />
                </Stack>
                <EditSlotProgrammingForm
                  newSlotForType={newSlotForType}
                  allSlots={linkableSlots}
                  onLinkSourceSlot={handleLinkSourceSlot}
                  onUnlinkFromGroup={handleUnlinkFromGroup}
                />
              </Stack>
            </TabPanel>

            <TabPanel value={tab} index={1}>
              <SlotFillerDialogPanel />
            </TabPanel>
            <TabPanel value={tab} index={2}>
              <TimeSlotConfigDialogPanel />
            </TabPanel>
            <TabPanel value={tab} index={3}>
              <MidRollConfigPanel />
            </TabPanel>
          </FormProvider>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => cancel()}>
          <Trans>Cancel</Trans>
        </Button>
        <Button
          disabled={!isValid || isSubmitting}
          onClick={() => commit()}
          variant="contained"
        >
          <Trans>Save</Trans>
        </Button>
      </DialogActions>
    </>
  );
};
