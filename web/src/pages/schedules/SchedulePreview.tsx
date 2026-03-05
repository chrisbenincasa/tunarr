import { Preview } from '@mui/icons-material';
import { Box, Button, Stack } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { isNonEmptyString, seq } from '@tunarr/shared/util';
import type {
  InfiniteSchedulePreviewResponse,
  MaterializedSchedule2,
} from '@tunarr/types/api';
import { useToggle } from '@uidotdev/usehooks';
import dayjs from 'dayjs';
import { useSnackbar } from 'notistack';
import pluralize from 'pluralize';
import { useCallback, useMemo, useState } from 'react';
import { match, P } from 'ts-pattern';
import { RotatingLoopIcon } from '../../components/base/LoadingIcon.tsx';
import ChannelLineupList from '../../components/channel_config/ChannelLineupList.tsx';
import { previewScheduleMutation } from '../../generated/@tanstack/react-query.gen.ts';
import type {
  UIChannelProgram,
  UIFlexProgram,
  UIRedirectProgram,
} from '../../types/index.ts';
import type { Nilable } from '../../types/util.ts';
import { type Nullable } from '../../types/util.ts';

type Props = {
  schedule: MaterializedSchedule2;
};

export const SchedulePreview = ({ schedule }: Props) => {
  const [preview, setPreview] =
    useState<Nullable<InfiniteSchedulePreviewResponse>>(null);
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
    return seq.collect(preview?.items, (scheduleItem, idx) => {
      return match(scheduleItem)
        .returnType<Nilable<UIChannelProgram>>()
        .with(
          { itemType: 'content', programUuid: P.when(isNonEmptyString) },
          (c) => {
            const program = preview?.contentPrograms[c.programUuid];
            if (!program) return;
            return {
              ...program,
              uiIndex: idx,
              originalIndex: idx,
              startTime: c.startTimeMs,
            } satisfies UIChannelProgram;
          },
        )
        .with(
          { itemType: 'flex' },
          (f) =>
            ({
              duration: f.durationMs,
              originalIndex: idx,
              uiIndex: idx,
              persisted: false,
              type: 'flex',
              startTime: f.startTimeMs,
            }) satisfies UIFlexProgram,
        )
        .with(
          { itemType: 'redirect' },
          (rdir) =>
            ({
              ...rdir,
              type: 'redirect',
              channelName: '',
              channelNumber: -1,
              channel: rdir.redirectChannelId,
              duration: rdir.durationMs,
              uiIndex: idx,
              originalIndex: idx,
              persisted: false,
              startTime: rdir.startTimeMs,
            }) satisfies UIRedirectProgram,
        )
        .otherwise(() => null);
    });
  }, [preview?.contentPrograms, preview?.items]);

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
