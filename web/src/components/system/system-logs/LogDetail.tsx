import { useCopyToClipboard } from '@/hooks/useCopyToClipboard.ts';
import { useThemeTokens } from '@/hooks/useTunarrTheme.ts';
import { Trans, useLingui } from '@lingui/react/macro';
import { ContentCopy } from '@mui/icons-material';
import { Box, Button, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { MonoText } from '../../ui/MonoText.tsx';
import { formatContextValue, type LogLine } from './logLine.ts';

const SectionLabel = ({ children }: { children: ReactNode }) => {
  const { tokens } = useThemeTokens();
  return (
    <Typography
      component="h3"
      sx={{ color: tokens.textMuted, fontSize: 12, fontWeight: 600 }}
    >
      {children}
    </Typography>
  );
};

// The error and context fields of one log line, shown when its row expands.
export const LogDetail = ({ line }: { line: LogLine }) => {
  const { t } = useLingui();
  const { tokens, dense } = useThemeTokens();
  const copy = useCopyToClipboard();
  const errorHead = [line.err?.type, line.err?.message]
    .filter(Boolean)
    .join(': ');
  const context = Object.entries(line.context);

  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      sx={{ gap: dense ? 2 : 3, px: 2, py: dense ? 1.25 : 2, minWidth: 0 }}
    >
      {line.err && (
        <Stack sx={{ gap: 1, flex: { md: 1 }, minWidth: 0 }}>
          <SectionLabel>
            <Trans>Error</Trans>
          </SectionLabel>
          {errorHead && (
            <MonoText sx={{ color: tokens.error, overflowWrap: 'anywhere' }}>
              {errorHead}
            </MonoText>
          )}
          {line.err.stack && (
            <MonoText
              component="pre"
              sx={{
                m: 0,
                fontSize: 12,
                lineHeight: 1.6,
                color: tokens.textMuted,
                whiteSpace: 'pre',
                overflowX: 'auto',
              }}
            >
              {line.err.stack}
            </MonoText>
          )}
        </Stack>
      )}
      <Stack
        sx={{
          gap: 1,
          flex: { md: line.err ? '0 0 320px' : 1 },
          minWidth: 0,
        }}
      >
        <SectionLabel>
          <Trans>Context</Trans>
        </SectionLabel>
        <Box
          component="dl"
          sx={{
            m: 0,
            display: 'grid',
            gridTemplateColumns: 'minmax(80px, auto) minmax(0, 1fr)',
            columnGap: 1.5,
            rowGap: 0.5,
            fontSize: 13,
            '& dt': { color: tokens.textMuted },
            '& dd': { m: 0, overflowWrap: 'anywhere' },
          }}
        >
          <dt>
            <Trans>Time</Trans>
          </dt>
          <dd>
            <MonoText sx={{ fontSize: 13 }}>
              {new Date(line.time).toISOString()}
            </MonoText>
          </dd>
          {context.map(([key, value]) => (
            <Box key={key} sx={{ display: 'contents' }}>
              <dt>{key}</dt>
              <dd>
                <MonoText sx={{ fontSize: 13 }}>
                  {formatContextValue(value)}
                </MonoText>
              </dd>
            </Box>
          ))}
        </Box>
        <Box>
          <Button
            size="small"
            startIcon={<ContentCopy />}
            onClick={() => void copy(line.raw, t`Copied the log line`)}
          >
            <Trans>Copy raw line</Trans>
          </Button>
        </Box>
      </Stack>
    </Stack>
  );
};
