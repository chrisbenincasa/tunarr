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
import dayjs, { Dayjs } from 'dayjs';
import { Link as RouterLink } from 'react-router-dom';
import { useSlideSchedule } from '@/hooks/programming_controls/useSlideSchedule.ts';
import { usePreloadedChannelEdit } from '@/hooks/usePreloadedChannel.ts';
import {
  resetCurrentLineup,
  resetLineup,
  setChannelStartTime,
} from '@/store/channelEditor/actions.ts';
import AddProgrammingButton from './AddProgrammingButton.tsx';
import ChannelProgrammingList from './ChannelProgrammingList.tsx';
import { ChannelProgrammingSort } from './ChannelProgrammingSort.tsx';
import { ChannelProgrammingTools } from './ChannelProgrammingTools.tsx';
import useStore from '@/store/index.ts';
import { Save, Undo } from '@mui/icons-material';
import { useState } from 'react';
import { channelProgramUniqueId } from '@/helpers/util.ts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ZodiosError } from '@zodios/core';
import { isUndefined, chain, first, findIndex, map } from 'lodash-es';
import { UpdateChannelProgrammingRequest } from '@tunarr/types/api';
import { useTunarrApi } from '@/hooks/useTunarrApi.ts';
import { useUpdateChannel } from '@/hooks/useUpdateChannel.ts';
import { useSnackbar } from 'notistack';

type MutateArgs = {
  channelId: string;
  lineupRequest: UpdateChannelProgrammingRequest;
};

export function ChannelProgrammingConfig() {
  const apiClient = useTunarrApi();
  const queryClient = useQueryClient();
  const {
    currentEntity: channel,
    originalEntity: originalChannel,
    schedule,
    programList: newLineup,
  } = usePreloadedChannelEdit();
  const theme = useTheme();
  const smallViewport = useMediaQuery(theme.breakpoints.down('sm'));
  const mediumViewport = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  const programsDirty = useStore((s) => s.channelEditor.dirty.programs);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const snackbar = useSnackbar();

  const slideSchedule = useSlideSchedule();

  const handleStartTimeChange = (value: Dayjs | null) => {
    if (value) {
      const newStartTime = value.unix() * 1000;
      setChannelStartTime(newStartTime);
      const prevStartTime = channel?.startTime;
      if (prevStartTime) {
        const diff = newStartTime - prevStartTime;
        slideSchedule(diff);
      }
    }
  };

  const updateLineupMutation = useMutation({
    mutationFn: ({ channelId, lineupRequest }: MutateArgs) => {
      return apiClient.post('/api/channels/:id/programming', lineupRequest, {
        params: { id: channelId },
      });
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
    onSuccess: async (data, { channelId: channelNumber }) => {
      resetCurrentLineup(data.lineup, data.programs);

      snackbar.enqueueSnackbar('Programs saved!', {
        variant: 'success',
      });

      await queryClient.invalidateQueries({
        queryKey: ['channels', channelNumber],
      });
    },
    onError: (error) => {
      snackbar.enqueueSnackbar('Error saving programs. ' + error.message, {
        variant: 'error',
      });

      if (error instanceof ZodiosError) {
        console.error(error.data);
        console.error(error, error.cause);
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
      .map(first)
      .compact()
      .value();

    // Create the in-order lineup which is a lookup array - we have the index
    // to the actual program (in the unique programs list) and then the
    // duration of the lineup item.
    const lineup = map(newLineup, (lineupItem) => {
      const index = findIndex(
        uniquePrograms,
        (uniq) =>
          channelProgramUniqueId(lineupItem) === channelProgramUniqueId(uniq),
      );
      return { duration: lineupItem.duration, index };
    });

    updateLineupMutation
      .mutateAsync({
        channelId: channel!.id,
        lineupRequest: { type: 'manual', lineup, programs: uniquePrograms },
      })
      .catch(console.error);
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
              <Save />
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
