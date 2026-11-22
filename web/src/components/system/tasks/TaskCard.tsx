import { useDayjs } from '@/hooks/useDayjs.ts';
import { useThemeTokens } from '@/hooks/useTunarrTheme.ts';
import { Trans, useLingui } from '@lingui/react/macro';
import { PlayArrowOutlined } from '@mui/icons-material';
import { Box, Button, Stack, Typography } from '@mui/material';
import type { Task } from '@tunarr/types';
import { Fragment, type ReactNode } from 'react';
import { MonoText } from '../../ui/MonoText.tsx';
import { TaskStatusPill } from './TaskStatusPill.tsx';
import { lastRunEpoch, nextRunEpoch } from './taskSchedule.ts';

export type TaskCardProps = {
  task: Task;
  onRun: () => void;
};

const RunTime = ({ label, value }: { label: ReactNode; value: ReactNode }) => {
  const { tokens } = useThemeTokens();
  return (
    <>
      <Typography sx={{ color: tokens.textMuted, fontSize: 13 }}>
        {label}
      </Typography>
      <MonoText sx={{ fontSize: 13 }}>{value}</MonoText>
    </>
  );
};

export const TaskCard = ({ task, onRun }: TaskCardProps) => {
  const { t } = useLingui();
  const dayjs = useDayjs();
  const { theme, tokens, dense } = useThemeTokens();
  const formatEpoch = (epoch: number | undefined) =>
    epoch ? dayjs(epoch * 1000).format('lll') : '—';

  return (
    <Box
      component="article"
      aria-label={task.name}
      sx={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: dense ? 0.75 : 1.25,
        p: dense ? 1.25 : 2,
        backgroundColor: tokens.surface,
        border: `1px solid ${tokens.border}`,
        borderRadius: `${theme.sizes.radiusCard}px`,
      }}
    >
      {/* Task names are single CamelCase words, so offer a break at each capital. */}
      <Typography
        variant="h2"
        sx={{
          fontSize: dense ? 15 : 17,
          fontWeight: 700,
          overflowWrap: 'anywhere',
        }}
      >
        {task.name.split(/(?=[A-Z])/).map((word, i) => (
          <Fragment key={i}>
            {i > 0 && <wbr />}
            {word}
          </Fragment>
        ))}
      </Typography>

      <Box>
        <TaskStatusPill task={task} />
      </Box>

      {task.description && (
        <Typography
          sx={{
            color: tokens.textMuted,
            fontSize: 13,
            overflowWrap: 'anywhere',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {task.description}
        </Typography>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          columnGap: 1.5,
          rowGap: 0.25,
          alignItems: 'baseline',
        }}
      >
        <RunTime
          label={<Trans>Last run</Trans>}
          value={formatEpoch(lastRunEpoch(task))}
        />
        <RunTime
          label={<Trans>Next run</Trans>}
          value={formatEpoch(nextRunEpoch(task))}
        />
      </Box>

      <Stack direction="row" sx={{ mt: 'auto', pt: 0.5 }}>
        <Button
          variant="outlined"
          startIcon={<PlayArrowOutlined />}
          aria-label={t`Run ${task.name}`}
          onClick={onRun}
          sx={{ flex: 1 }}
        >
          <Trans>Run now</Trans>
        </Button>
      </Stack>
    </Box>
  );
};
