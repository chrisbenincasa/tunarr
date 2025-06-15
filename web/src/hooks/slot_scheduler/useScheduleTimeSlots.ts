import { useMutation } from '@tanstack/react-query';
import type { ChannelProgram } from '@tunarr/types';
import dayjs from 'dayjs';
import { isError } from 'lodash-es';
import { useSnackbar } from 'notistack';
import pluralize from 'pluralize';
import { useCallback, useMemo } from 'react';
import { zipWithIndex } from '../../helpers/util.ts';
import type { TimeSlotForm } from '../../pages/channels/TimeSlotEditorPage.tsx';
import {
  setCurrentLineup,
  updateCurrentChannel,
} from '../../store/channelEditor/actions.ts';
import { addProgramsToLookupTable } from '../../store/programming/action.ts';
import {
  materializeProgramList,
  useChannelEditorLazy,
} from '../../store/selectors.ts';
import { useTunarrApi } from '../useTunarrApi.ts';

type TimeSlotMutArgs = { channelId: string; values: TimeSlotForm };

export const useScheduleTimeSlots = () => {
  const snackbar = useSnackbar();
  const apiClient = useTunarrApi();
  const {
    channelEditor: { currentEntity: channel },
  } = useChannelEditorLazy();

  const scheduleTimeSlotsMut = useMutation({
    mutationFn: ({ channelId, values }: TimeSlotMutArgs) =>
      apiClient.scheduleTimeSlots(
        {
          schedule: {
            ...values,
            timeZoneOffset: new Date().getTimezoneOffset(),
            type: 'time',
          },
        },
        {
          params: {
            channelId,
          },
        },
      ),
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
    (formValues: TimeSlotForm) => {
      const generateScheduleInner = async () => {
        performance.mark('guide-start');
        return scheduleTimeSlotsMut
          .mutateAsync({ channelId: channel!.id, values: formValues })
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

      return new Promise<{ programs: ChannelProgram[]; startTime: number }>(
        (resolve, reject) => {
          setTimeout(() => {
            generateScheduleInner().then(resolve).catch(reject);
          });
        },
      );
    },
    [channel, scheduleTimeSlotsMut, showPerfSnackbar, snackbar],
  );

  return useMemo(
    () => ({
      scheduleTimeSlots: scheduleFunc,
    }),
    [scheduleFunc],
  );
};
