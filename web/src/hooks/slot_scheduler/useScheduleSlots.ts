import type { RandomSlotForm } from '@/model/SlotModels.ts';
import { useMutation } from '@tanstack/react-query';
import type { ChannelProgram } from '@tunarr/types';
import dayjs from 'dayjs';
import { isError } from 'lodash-es';
import { useSnackbar } from 'notistack';
import pluralize from 'pluralize';
import { useCallback, useMemo } from 'react';
import {
  postApiChannelsByChannelIdScheduleSlots,
  postApiChannelsByChannelIdScheduleTimeSlots,
} from '../../generated/sdk.gen.ts';
import { zipWithIndex } from '../../helpers/util.ts';
import type { TimeSlotForm } from '../../model/TimeSlotModels.ts';
import {
  setCurrentLineup,
  updateCurrentChannel,
} from '../../store/channelEditor/actions.ts';
import { addProgramsToLookupTable } from '../../store/programming/action.ts';
import {
  materializeProgramList,
  useChannelEditorLazy,
} from '../../store/selectors.ts';

type TimeSlotMutArgs = { channelId: string; values: TimeSlotForm };
type SlotMutArgs = { channelId: string; values: RandomSlotForm };

type TimeOrRandomForm =
  | ({ type: 'time' } & TimeSlotForm)
  | ({ type: 'random' } & RandomSlotForm);

export const useScheduleSlots = () => {
  const snackbar = useSnackbar();
  const {
    channelEditor: { currentEntity: channel },
  } = useChannelEditorLazy();

  const scheduleTimeSlotsMut = useMutation({
    mutationFn: ({ channelId, values }: TimeSlotMutArgs) =>
      postApiChannelsByChannelIdScheduleTimeSlots({
        path: { channelId },
        body: {
          schedule: {
            ...values,
            timeZoneOffset: new Date().getTimezoneOffset(),
            type: 'time',
          },
        },
        throwOnError: true,
      }).then(({ data }) => data),
  });

  const scheduleSlotsMut = useMutation({
    mutationFn: ({ channelId, values }: SlotMutArgs) =>
      postApiChannelsByChannelIdScheduleSlots({
        path: { channelId },
        body: {
          schedule: {
            ...values,
            timeZoneOffset: new Date().getTimezoneOffset(),
            type: 'random',
          },
        },
        throwOnError: true,
      }).then(({ data }) => data),
  });

  const showPerfSnackbar = useCallback(
    (maxDays: number, duration: number, numShows: number) => {
      const message = `Calculated ${dayjs
        .duration(maxDays, 'days')
        .humanize()} (${numShows} ${pluralize(
        'program',
        numShows,
      )}) of programming in ${duration}ms`;
      snackbar.enqueueSnackbar(message, {
        variant: 'info',
      });
    },
    [snackbar],
  );

  const scheduleFunc = useCallback(
    (formValues: TimeOrRandomForm) => {
      const generateScheduleInner = async () => {
        performance.mark('guide-start');
        const promise =
          formValues.type === 'time'
            ? scheduleTimeSlotsMut.mutateAsync({
                channelId: channel!.id,
                values: formValues,
              })
            : scheduleSlotsMut.mutateAsync({
                channelId: channel!.id,
                values: formValues,
              });
        return promise
          .then((res) => {
            performance.mark('guide-end');
            const { duration: ms } = performance.measure(
              'guide',
              'guide-start',
              'guide-end',
            );
            const materialized = materializeProgramList(
              zipWithIndex(res.lineup),
              res.programs,
            );
            showPerfSnackbar(
              formValues.maxDays,
              Math.round(ms),
              res.lineup.length,
            );
            updateCurrentChannel({ startTime: res.startTime });
            addProgramsToLookupTable(res.programs);
            setCurrentLineup(materialized, true);
            return {
              programs: materialized,
              startTime: res.startTime,
              seed: res.seed,
              discardCount: res.discardCount,
            };
          })
          .catch((e) => {
            snackbar.enqueueSnackbar(
              'There was an error generating time slots. Check the browser console log for more information',
              {
                variant: 'error',
              },
            );
            console.error(e);
            const error = isError(e) ? e : new Error(`${e}`);
            throw error;
          });
      };

      return new Promise<{
        programs: ChannelProgram[];
        startTime: number;
        seed: number[];
        discardCount: number;
      }>((resolve, reject) => {
        setTimeout(() => {
          generateScheduleInner().then(resolve).catch(reject);
        });
      });
    },
    [
      channel,
      scheduleSlotsMut,
      scheduleTimeSlotsMut,
      showPerfSnackbar,
      snackbar,
    ],
  );

  return useMemo(
    () => ({
      scheduleTimeSlots: (timeForm: TimeSlotForm) =>
        scheduleFunc({ type: 'time', ...timeForm }),
      scheduleSlots: (randomForm: RandomSlotForm) =>
        scheduleFunc({ type: 'random', ...randomForm }),
    }),
    [scheduleFunc],
  );
};
