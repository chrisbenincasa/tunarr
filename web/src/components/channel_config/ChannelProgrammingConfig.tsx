import { useUpdateChannel } from '@/hooks/useUpdateChannel.ts';
import { useUpdateLineup } from '@/hooks/useUpdateLineup.ts';
import { resetLineup } from '@/store/channelEditor/actions.ts';
import useStore from '@/store/index.ts';
import { useChannelEditor } from '@/store/selectors.ts';
import { Trans, useLingui } from '@lingui/react/macro';
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
import dayjs, { type Dayjs } from 'dayjs';
import { isUndefined, reject } from 'lodash-es';
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
  const { t } = useLingui();
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
      snackbar.enqueueSnackbar(t`Programs saved!`, {
        variant: 'success',
      });
    },
    onError: (error, vars) => {
      snackbar.enqueueSnackbar(t`Error saving programs. ${error.message}`, {
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

    updateLineupMutation.mutate({
      path: {
        id: channel!.id,
      },
      body: {
        type: 'manual',
        lineup: reject(newLineup, (lineupItem) => lineupItem.duration <= 0),
        append: false,
      },
    });
  };

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
                <Tooltip title={t`List`}>
                  <ToggleButton value="list">
                    <List />
                  </ToggleButton>
                </Tooltip>
                <Tooltip title={t`Day`}>
                  <ToggleButton value="day">
                    <CalendarViewDay />
                  </ToggleButton>
                </Tooltip>
                <Tooltip title={t`Week`}>
                  <ToggleButton value="week">
                    <CalendarViewWeek />
                  </ToggleButton>
                </Tooltip>
                <Tooltip title={t`Month`}>
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
                title={t`Reset changes made to the channel's lineup`}
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
                    <Trans>Reset</Trans>
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
                <Trans>Save</Trans>
              </Button>
            )}
          </Stack>
        </Stack>

        {renderView()}
      </Stack>
    </>
  );
}
