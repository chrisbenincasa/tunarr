import { Box, Button, Stack } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { isNonEmptyString, seq } from '@tunarr/shared/util';
import type {
  InfiniteSchedulePreviewResponse,
  MaterializedSchedule2,
} from '@tunarr/types/api';
import { useMemo, useState } from 'react';
import { match, P } from 'ts-pattern';
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
          onClick={() =>
            previewMutation.mutate({ path: { id: schedule.uuid } })
          }
          variant="contained"
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
      />
    </Stack>
  );
};
