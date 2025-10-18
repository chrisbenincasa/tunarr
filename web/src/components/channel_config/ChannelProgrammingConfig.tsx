import { channelProgramUniqueId } from '@/helpers/util.ts';
import { useUpdateChannel } from '@/hooks/useUpdateChannel.ts';
import { useUpdateLineup } from '@/hooks/useUpdateLineup.ts';
import { resetLineup } from '@/store/channelEditor/actions.ts';
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
  Divider,
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { seq } from '@tunarr/shared/util';
import dayjs, { type Dayjs } from 'dayjs';
import {
  findIndex,
  first,
  groupBy,
  isUndefined,
  map,
  reject,
  values,
} from 'lodash-es';
import { useSnackbar } from 'notistack';
import { useCallback, useMemo, useState } from 'react';
import type { CalendarState } from '../slot_scheduler/ProgramCalendarView.tsx';
import { ProgramCalendarView } from '../slot_scheduler/ProgramCalendarView.tsx';
import { ProgramDayCalendarView } from '../slot_scheduler/ProgramDayCalendarView.tsx';
import { ProgramWeekCalendarView } from '../slot_scheduler/ProgramWeekCalendarView.tsx';
import AddProgrammingButton from './AddProgrammingButton.tsx';
import ChannelLineupList from './ChannelLineupList.tsx';
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
  const programsDirty = useStore((s) => s.channelEditor.dirty.programs);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const snackbar = useSnackbar();

  const [view, setView] = useState<ViewType>('list');
  const [viewDate, setViewDate] = useState<Dayjs>(dayjs());
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

      console.error(error, vars.body);
    },
  });

  const updateChannelMutation = useUpdateChannel();

  const onSave = () => {
    setIsSubmitting(true);
    if (
      !isUndefined(channel) &&
      !isUndefined(originalChannel) &&
      channel.startTime !== originalChannel.startTime
    ) {
      updateChannelMutation.mutate({ path: { id: channel.id }, body: channel });
    }

    // Group programs by their unique ID. This will disregard their durations,
    // but we will keep the durations when creating the minimal lineup below
    const uniquePrograms = seq.collect(
      values(groupBy(newLineup, channelProgramUniqueId)),
      (v) => first(v),
    );

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
          case 'content':
          case 'redirect':
          case 'flex':
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
      path: {
        id: channel!.id,
      },
      body: {
        type: 'manual',
        lineup,
        programs: uniquePrograms,
        append: false,
      },
    });
  };

  // const ref = useRef<HTMLDivElement | null>(null);
  // const [listHeight, setListHeight] = useState(600);
  // const windowSize = useWindowSize();

  // useEffect(() => {
  //   console.log(ref.current);
  //   const rect = ref.current?.getBoundingClientRect();
  //   if (rect && windowSize.height) {
  //     console.log(rect.top, window.screenY);
  //     setListHeight(windowSize.height - (rect.top + window.scrollY) - 50);
  //   }
  // }, [windowSize.height]);

  const renderView = () => {
    switch (view) {
      case 'list':
        return (
          <ChannelLineupList
            type="selector"
            virtualListProps={{
              width: '100%',
              height: 600,
              itemSize: smallViewport ? 70 : 35,
            }}
            // listRef={ref}
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

  return (
    <>
      <Stack gap={2}>
        <Stack direction={{ md: 'column', lg: 'row' }} justifyContent="center">
          <Stack
            direction="row"
            flexGrow={1}
            alignItems={'center'}
            alignSelf={['center']}
            flex={1}
          >
            <Box>
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
              columnGap: 1,
              alignItems: 'center',
              justifyContent: { sm: 'flex-end' },
              alignSelf: ['center'],
              mt: { xs: 1 },
            }}
          >
            <ChannelProgrammingTools />
            <ChannelProgrammingSort />
            <AddProgrammingButton />
            <Divider sx={{ mx: 1 }} orientation="vertical" flexItem />

            {programsDirty && (
              <Tooltip
                title="Reset changes made to the channel's lineup"
                placement="top"
              >
                {smallViewport ? (
                  <IconButton
                    onClick={() => resetLineup()}
                    disabled={!programsDirty}
                  >
                    <Undo />
                  </IconButton>
                ) : (
                  <Button
                    onClick={() => resetLineup()}
                    disabled={!programsDirty}
                    startIcon={<Undo />}
                  >
                    Reset
                  </Button>
                )}
              </Tooltip>
            )}
            {smallViewport ? (
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
        </Stack>

        {renderView()}
      </Stack>
    </>
  );
}
