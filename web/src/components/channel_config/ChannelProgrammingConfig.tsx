import { channelProgramUniqueId } from '@/helpers/util.ts';
import { useSlideSchedule } from '@/hooks/programming_controls/useSlideSchedule.ts';
import { useUpdateChannel } from '@/hooks/useUpdateChannel.ts';
import { useUpdateLineup } from '@/hooks/useUpdateLineup.ts';
import {
  resetLineup,
  setChannelStartTime,
} from '@/store/channelEditor/actions.ts';
import useStore from '@/store/index.ts';
import { useChannelEditor } from '@/store/selectors.ts';
import {
  CalendarViewDay,
  CalendarViewMonth,
  CalendarViewWeek,
  List,
  Save,
  Undo,
} from '@mui/icons-material';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers';
import { ZodiosError } from '@zodios/core';
import dayjs, { type Dayjs } from 'dayjs';
import { chain, findIndex, head, isUndefined, map, reject } from 'lodash-es';
import { useSnackbar } from 'notistack';
import { useCallback, useMemo, useState } from 'react';
import { ZodError } from 'zod';
import type { CalendarState } from '../slot_scheduler/ProgramCalendarView.tsx';
import { ProgramCalendarView } from '../slot_scheduler/ProgramCalendarView.tsx';
import { ProgramDayCalendarView } from '../slot_scheduler/ProgramDayCalendarView.tsx';
import { ProgramWeekCalendarView } from '../slot_scheduler/ProgramWeekCalendarView.tsx';
import AddProgrammingButton from './AddProgrammingButton.tsx';
import ChannelProgrammingList from './ChannelProgrammingList.tsx';
import { ChannelProgrammingSort } from './ChannelProgrammingSort.tsx';
import { ChannelProgrammingTools } from './ChannelProgrammingTools.tsx';

type ViewType = 'list' | 'day' | 'week' | 'month';

export function ChannelProgrammingConfig() {
  const {
    currentEntity: channel,
    originalEntity: originalChannel,
    programList: newLineup,
  } = useChannelEditor();
  const theme = useTheme();
  const smallViewport = useMediaQuery(theme.breakpoints.down('sm'));
  const mediumViewport = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  const programsDirty = useStore((s) => s.channelEditor.dirty.programs);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const snackbar = useSnackbar();

  const [view, setView] = useState<ViewType>('list');
  const [viewDate, setViewDate] = useState<Dayjs>(dayjs(channel?.startTime));
  const calendarState = useMemo(
    () =>
      ({
        month: viewDate.month(),
        year: viewDate.year(),
      }) satisfies CalendarState,
    [viewDate],
  );

  const onCalendarStateChange = useCallback((date: CalendarState) => {
    setViewDate((prev) => prev.month(date.month).year(date.year));
  }, []);

  const handleCalendarDaySelect = useCallback((date: Dayjs) => {
    setViewDate(date);
    setView('day');
  }, []);

  const slideSchedule = useSlideSchedule();

  const handleStartTimeChange = (value: Dayjs | null) => {
    if (value) {
      const newStartTime = +value;
      setChannelStartTime(newStartTime);
      const prevStartTime = channel?.startTime;
      if (prevStartTime) {
        const diff = newStartTime - prevStartTime;
        slideSchedule(diff);
      }
    }
  };

  const updateLineupMutation = useUpdateLineup({
    onSettled: () => {
      setIsSubmitting(false);
    },
    onSuccess: () => {
      snackbar.enqueueSnackbar('Programs saved!', {
        variant: 'success',
      });
    },
    onError: (error, vars) => {
      snackbar.enqueueSnackbar('Error saving programs. ' + error.message, {
        variant: 'error',
      });

      console.error(error, vars.lineupRequest);
      if (error instanceof ZodiosError) {
        console.error(error.cause, error.message);
        if (error.cause instanceof ZodError) {
          console.error(error.cause.message, error.cause.issues);
        }
      }
    },
  });

  const updateChannelMutation = useUpdateChannel(/*isNewChannel=*/ false);

  const onSave = () => {
    setIsSubmitting(true);
    if (
      !isUndefined(channel) &&
      !isUndefined(originalChannel) &&
      channel.startTime !== originalChannel.startTime
    ) {
      updateChannelMutation.mutate({
        ...channel,
        // This is a little wonky...
        transcoding: {
          targetResolution: channel.transcoding?.targetResolution ?? 'global',
          videoBitrate: channel.transcoding?.videoBitrate ?? 'global',
          videoBufferSize: channel.transcoding?.videoBufferSize ?? 'global',
        },
      });
    }

    // Group programs by their unique ID. This will disregard their durations,
    // but we will keep the durations when creating the minimal lineup below
    const uniquePrograms = chain(newLineup)
      .groupBy(channelProgramUniqueId)
      .values()
      .map((l) => head(l))
      .compact()
      .value();

    // Create the in-order lineup which is a lookup array - we have the index
    // to the actual program (in the unique programs list) and then the
    // duration of the lineup item.
    const lineup = map(
      reject(newLineup, (lineupItem) => lineupItem.duration <= 0),
      (lineupItem) => {
        switch (lineupItem.type) {
          case 'custom':
            return {
              type: 'persisted' as const,
              programId: lineupItem.id,
              customShowId: lineupItem.customShowId,
              duration: lineupItem.duration,
            };
          default: {
            const index = findIndex(
              uniquePrograms,
              (uniq) =>
                channelProgramUniqueId(lineupItem) ===
                channelProgramUniqueId(uniq),
            );
            return {
              duration: lineupItem.duration,
              index,
              type: 'index' as const,
            };
          }
        }
      },
    );

    updateLineupMutation.mutate({
      channelId: channel!.id,
      lineupRequest: {
        type: 'manual',
        lineup,
        programs: uniquePrograms,
        append: false,
      },
    });
  };

  const renderView = () => {
    switch (view) {
      case 'list':
        return (
          <ChannelProgrammingList
            type="selector"
            virtualListProps={{
              width: '100%',
              height: 600,
              itemSize: smallViewport ? 70 : 35,
            }}
          />
        );
      case 'day':
        return (
          <ProgramDayCalendarView
            calendarState={viewDate}
            onChange={setViewDate}
          />
        );
      case 'week':
        return (
          <ProgramWeekCalendarView
            calendarState={viewDate}
            onChange={setViewDate}
            onSelectDay={handleCalendarDaySelect}
          />
        );
      case 'month':
        return (
          <ProgramCalendarView
            calendarState={calendarState}
            onChange={onCalendarStateChange}
            onSelectDay={handleCalendarDaySelect}
          />
        );
    }
  };

  const startTime = channel ? dayjs(channel.startTime) : dayjs();
  return (
    <>
      <Stack gap={2}>
        <Stack direction="row" flexGrow={1} alignItems={'center'}>
          <Box flex={1}>
            <DateTimePicker
              label="Programming Start"
              value={startTime}
              onChange={(newDateTime) => handleStartTimeChange(newDateTime)}
              slotProps={{ textField: { size: 'small' } }}
            />
          </Box>
          <Box alignSelf={'flex-end'}>
            <ToggleButtonGroup
              value={view}
              exclusive
              onChange={(_, v) => setView(v as ViewType)}
            >
              <Tooltip title="List">
                <ToggleButton value="list">
                  <List />
                </ToggleButton>
              </Tooltip>
              <Tooltip title="Day">
                <ToggleButton value="day">
                  <CalendarViewDay />
                </ToggleButton>
              </Tooltip>
              <Tooltip title="Week">
                <ToggleButton value="week">
                  <CalendarViewWeek />
                </ToggleButton>
              </Tooltip>
              <Tooltip title="Month">
                <ToggleButton value="month">
                  <CalendarViewMonth />
                </ToggleButton>
              </Tooltip>
            </ToggleButtonGroup>
          </Box>
        </Stack>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          gap={{ xs: 1 }}
          sx={{
            display: 'flex',
            pt: 1,
            columnGap: 1,
            alignItems: 'center',
            justifyContent: { sm: 'flex-end' },
          }}
        >
          <ChannelProgrammingTools />
          <ChannelProgrammingSort />
          <AddProgrammingButton />
          {programsDirty && (
            <Tooltip
              title="Reset changes made to the channel's lineup"
              placement="top"
            >
              {mediumViewport ? (
                <IconButton
                  onClick={() => resetLineup()}
                  disabled={!programsDirty}
                  color="primary"
                >
                  <Undo />
                </IconButton>
              ) : (
                <Button
                  variant="contained"
                  onClick={() => resetLineup()}
                  disabled={!programsDirty}
                  startIcon={<Undo />}
                >
                  Reset
                </Button>
              )}
            </Tooltip>
          )}
          {mediumViewport ? (
            <IconButton
              onClick={() => onSave()}
              disabled={!programsDirty || isSubmitting}
            >
              {isSubmitting ? (
                <CircularProgress
                  size="20px"
                  sx={{ mx: 1, color: 'inherit' }}
                />
              ) : (
                <Save />
              )}
            </IconButton>
          ) : (
            <Button
              variant="contained"
              onClick={() => onSave()}
              disabled={!programsDirty || isSubmitting}
              startIcon={
                isSubmitting ? (
                  <CircularProgress
                    size="20px"
                    sx={{ mx: 1, color: 'inherit' }}
                  />
                ) : (
                  <Save />
                )
              }
            >
              Save
            </Button>
          )}
        </Stack>

        {renderView()}
      </Stack>
    </>
  );
}
