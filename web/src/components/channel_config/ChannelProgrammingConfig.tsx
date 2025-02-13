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
import { Save, Undo } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Link,
  Stack,
  Tooltip,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers';
import { Link as RouterLink } from '@tanstack/react-router';
import { ZodiosError } from '@zodios/core';
import dayjs, { type Dayjs } from 'dayjs';
import { chain, findIndex, head, isUndefined, map, reject } from 'lodash-es';
import { useSnackbar } from 'notistack';
import { useState } from 'react';
import { ZodError } from 'zod';
import AddProgrammingButton from './AddProgrammingButton.tsx';
import ChannelProgrammingList from './ChannelProgrammingList.tsx';
import { ChannelProgrammingSort } from './ChannelProgrammingSort.tsx';
import { ChannelProgrammingTools } from './ChannelProgrammingTools.tsx';

export function ChannelProgrammingConfig() {
  const {
    currentEntity: channel,
    originalEntity: originalChannel,
    schedule,
    programList: newLineup,
  } = useChannelEditor();
  const theme = useTheme();
  const smallViewport = useMediaQuery(theme.breakpoints.down('sm'));
  const mediumViewport = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  const programsDirty = useStore((s) => s.channelEditor.dirty.programs);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const snackbar = useSnackbar();

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
      .groupBy((lineupItem) => channelProgramUniqueId(lineupItem))
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
        const index = findIndex(
          uniquePrograms,
          (uniq) =>
            channelProgramUniqueId(lineupItem) === channelProgramUniqueId(uniq),
        );
        return { duration: lineupItem.duration, index };
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

  const startTime = channel ? dayjs(channel.startTime) : dayjs();
  return (
    <>
      <Box display="flex" flexDirection="column">
        {schedule && (
          <Alert sx={{ mb: 2 }} severity="info">
            This channel is setup to use{' '}
            <Link
              to={
                schedule.type === 'time'
                  ? 'time-slot-editor'
                  : 'random-slot-editor'
              }
              component={RouterLink}
            >
              {schedule.type === 'time' ? 'Time ' : 'Random '}
              Slots
            </Link>{' '}
            for programming. Any manual changes on this page will likely make
            this channel stop adhering to that schedule.
          </Alert>
        )}

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          gap={{ xs: 1 }}
          sx={{
            display: 'flex',
            pt: 1,
            mb: 2,
            columnGap: 1,
            alignItems: 'center',
          }}
        >
          <Box sx={{ mr: { sm: 2 }, flexGrow: 1 }}>
            <DateTimePicker
              label="Programming Start"
              value={startTime}
              onChange={(newDateTime) => handleStartTimeChange(newDateTime)}
              slotProps={{ textField: { size: 'small' } }}
            />
          </Box>
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

        <ChannelProgrammingList
          type="selector"
          virtualListProps={{
            width: '100%',
            height: 600,
            itemSize: smallViewport ? 70 : 35,
          }}
        />
      </Box>
    </>
  );
}
