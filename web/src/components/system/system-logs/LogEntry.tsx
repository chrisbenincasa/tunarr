import { useThemeTokens } from '@/hooks/useTunarrTheme.ts';
import { useLingui } from '@lingui/react/macro';
import { Box, ButtonBase, Stack, Typography } from '@mui/material';
import { useId, useState } from 'react';
import { MonoText } from '../../ui/MonoText.tsx';
import { LogDetail } from './LogDetail.tsx';
import { LogLevelPill } from './LogLevelPill.tsx';
import type { LogLine } from './logLine.ts';

export type LogEntryProps = {
  line: LogLine;
  formatTime: (time: number) => string;
};

// One log line in the phone layout. Tapping it shows its detail below.
export const LogEntry = ({ line, formatTime }: LogEntryProps) => {
  const { t } = useLingui();
  const { theme, tokens } = useThemeTokens();
  const [expanded, setExpanded] = useState(false);
  const detailId = useId();

  return (
    <Box
      component="article"
      aria-label={line.msg}
      sx={{
        width: '100%',
        minWidth: 0,
        backgroundColor: expanded ? tokens.surfaceRaised : tokens.surface,
        border: `1px solid ${tokens.border}`,
        borderRadius: `${theme.sizes.radiusCard}px`,
        overflow: 'hidden',
      }}
    >
      <ButtonBase
        aria-expanded={expanded}
        aria-controls={detailId}
        aria-label={
          expanded
            ? t`Hide details for ${line.msg}`
            : t`Show details for ${line.msg}`
        }
        onClick={() => setExpanded((e) => !e)}
        sx={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: 0.75,
          px: 1.75,
          py: 1.5,
          textAlign: 'left',
        }}
      >
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
          <LogLevelPill level={line.level} />
          <Typography
            sx={{
              flex: 1,
              minWidth: 0,
              fontSize: 13,
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {line.caller}
          </Typography>
          <MonoText sx={{ fontSize: 12, color: tokens.textMuted }}>
            {formatTime(line.time)}
          </MonoText>
        </Stack>
        <Typography
          sx={{
            fontSize: 13,
            overflowWrap: 'anywhere',
            display: '-webkit-box',
            WebkitLineClamp: expanded ? 'unset' : 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {line.msg}
        </Typography>
      </ButtonBase>
      {expanded && (
        <Box id={detailId}>
          <LogDetail line={line} />
        </Box>
      )}
    </Box>
  );
};
