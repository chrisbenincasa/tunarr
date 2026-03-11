import { Preview } from '@mui/icons-material';
import { Box, Button, Stack } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import type {
  InfiniteScheduleGenerationResponse,
  MaterializedSchedule2,
} from '@tunarr/types/api';
import { useToggle } from '@uidotdev/usehooks';
import dayjs from 'dayjs';
import { useSnackbar } from 'notistack';
import pluralize from 'pluralize';
import { useCallback, useMemo, useState } from 'react';
import { RotatingLoopIcon } from '../../components/base/LoadingIcon.tsx';
import ChannelLineupList from '../../components/channel_config/ChannelLineupList.tsx';
import { previewScheduleMutation } from '../../generated/@tanstack/react-query.gen.ts';

import { scheduleGenerationResponseToLineupList } from '../../helpers/converters.ts';
import { type Nullable } from '../../types/util.ts';

type Props = {
  schedule: MaterializedSchedule2;
};

export const SchedulePreview = ({ schedule }: Props) => {
  const [preview, setPreview] =
    useState<Nullable<InfiniteScheduleGenerationResponse>>(null);
  const previewMutation = useMutation({
    ...previewScheduleMutation(),
    onSuccess(data) {
      setPreview(data);
    },
  });

  const [calculatingPreview, setIsCalculatingPreview] = useToggle(false);

  const snackbar = useSnackbar();

  const generatePreview = useCallback(() => {
    setIsCalculatingPreview(true);
    const nestedFunc = async () => {
      performance.mark('guide-start');
      const startTime = +dayjs().startOf('day');
      const endTime = +dayjs().startOf('day').add(1, 'week');

      const result = await previewMutation.mutateAsync({
        path: { id: schedule.uuid },
        query: {
          startTimeMs: startTime,
          endTimeMs: endTime,
        },
      });

      performance.mark('guide-end');
      const { duration: ms } = performance.measure(
        'guide',
        'guide-start',
        'guide-end',
      );

      const message = `Calculated ${dayjs
        .duration(endTime - startTime)
        .humanize()} (${result.items.length} ${pluralize(
        'program',
        result.items.length,
      )}) of programming in ${ms}ms`;
      snackbar.enqueueSnackbar(message, {
        variant: 'info',
      });
    };

    setTimeout(() => {
      nestedFunc()
        .catch((err) => {
          console.error(err);
          snackbar.enqueueSnackbar({
            message: 'Failure while calculating schedule preview',
            variant: 'error',
          });
        })
        .finally(() => {
          setIsCalculatingPreview(false);
        });
    });
  }, [previewMutation, schedule.uuid, setIsCalculatingPreview, snackbar]);

  const programList = useMemo(() => {
    if (!preview) {
      return [];
    }
    return scheduleGenerationResponseToLineupList(preview);
  }, [preview]);

  return (
    <Stack>
      <Box sx={{ ml: 'auto' }}>
        <Button
          disabled={calculatingPreview}
          onClick={() => generatePreview()}
          variant="contained"
          startIcon={calculatingPreview ? <RotatingLoopIcon /> : <Preview />}
        >
          Preview Schedule
        </Button>
      </Box>
      <ChannelLineupList
        type="direct"
        programList={programList}
        enableRowDelete={false}
        enableRowEdit={false}
        enableDnd={false}
        listEmptyMessage=""
        virtualListProps={{
          width: '100%',
          height: 600,
          itemSize: 35,
          overscanCount: 5,
        }}
      />
    </Stack>
  );
};
