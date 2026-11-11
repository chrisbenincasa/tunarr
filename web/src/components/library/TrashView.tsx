import { useThemeTokens } from '@/hooks/useTunarrTheme.ts';
import { Trans, useLingui } from '@lingui/react/macro';
import {
  Delete,
  Movie,
  MusicNote,
  MusicVideo,
  Tv,
  Videocam,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Chip,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import type { ContentProgramType } from '@tunarr/types/schemas';
import type { ReactElement, ReactNode } from 'react';
import { MonoText } from '../ui/MonoText.tsx';
import { PageHeader } from '../ui/PageHeader.tsx';

export type TrashItemType = ContentProgramType;

export type TrashDrain =
  | { state: 'idle' }
  | { state: 'starting' }
  | { state: 'running'; deleted: number; total: number }
  | { state: 'cancelling'; deleted: number; total: number };

export type TrashViewProps = {
  // Empty means every type.
  selectedTypes: TrashItemType[];
  onTypesChange: (types: TrashItemType[]) => void;
  drain: TrashDrain;
  onEmptyTrash: () => void;
  onCancel: () => void;

  // The program grid.
  children: ReactNode;
};

type FilterChipProps = {
  label: ReactNode;
  icon?: ReactElement;
  selected: boolean;
  onClick: () => void;
};

const FilterChip = ({ label, icon, selected, onClick }: FilterChipProps) => {
  const { theme, tokens, dense } = useThemeTokens();

  return (
    <Chip
      label={label}
      icon={icon}
      variant="outlined"
      onClick={onClick}
      aria-pressed={selected}
      sx={{
        height: theme.sizes.controlHeightSmall,
        paddingInline: 0.5,
        fontSize: dense ? 12 : 13,
        color: selected ? tokens.accent : tokens.textMuted,
        borderColor: selected ? tokens.accent : tokens.borderStrong,
        backgroundColor: selected ? tokens.accentSoft : 'transparent',
        '& .MuiChip-icon': { color: 'inherit', fontSize: dense ? 16 : 18 },
        '&.MuiChip-clickable:hover': {
          backgroundColor: selected ? tokens.accentSoft : tokens.surfaceRaised,
        },
      }}
    />
  );
};

type DrainProgressProps = {
  deleted: number;
  total: number;
  cancelling: boolean;
  onCancel: () => void;
};

const DrainProgress = ({
  deleted,
  total,
  cancelling,
  onCancel,
}: DrainProgressProps) => {
  const { t } = useLingui();
  const { theme, tokens } = useThemeTokens();
  const percent = total > 0 ? Math.min(100, (deleted / total) * 100) : 0;
  const count = `${deleted} / ${total}`;

  return (
    <Box
      sx={{
        mb: 2,
        p: `${theme.sizes.cardPadding}px`,
        border: `1px solid ${tokens.border}`,
        borderRadius: `${theme.sizes.radiusCard}px`,
        backgroundColor: tokens.surface,
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={2}
        sx={{ mb: 1.5 }}
      >
        <Typography sx={{ color: tokens.text }}>
          {cancelling ? (
            <Trans>
              Cancelling:{' '}
              <MonoText sx={{ whiteSpace: 'nowrap' }}>{count}</MonoText> removed
            </Trans>
          ) : (
            <Trans>
              Emptying trash:{' '}
              <MonoText sx={{ whiteSpace: 'nowrap' }}>{count}</MonoText>
            </Trans>
          )}
        </Typography>
        <Button variant="outlined" disabled={cancelling} onClick={onCancel}>
          <Trans>Cancel</Trans>
        </Button>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={percent}
        aria-label={t`Empty trash progress`}
        sx={{
          backgroundColor: tokens.border,
          '& .MuiLinearProgress-bar': {
            backgroundColor: cancelling ? tokens.warning : tokens.accent,
          },
        }}
      />
    </Box>
  );
};

export const TrashView = ({
  selectedTypes,
  onTypesChange,
  drain,
  onEmptyTrash,
  onCancel,
  children,
}: TrashViewProps) => {
  const { t } = useLingui();

  const typeOptions: {
    value: TrashItemType;
    label: string;
    icon: ReactElement;
  }[] = [
    { value: 'movie', label: t`Movies`, icon: <Movie /> },
    { value: 'episode', label: t`Episodes`, icon: <Tv /> },
    { value: 'track', label: t`Tracks`, icon: <MusicNote /> },
    { value: 'other_video', label: t`Other Videos`, icon: <Videocam /> },
    { value: 'music_video', label: t`Music Videos`, icon: <MusicVideo /> },
  ];

  // Keep the option order so the same selection always builds the same filter.
  const toggleType = (type: TrashItemType) => {
    const next = selectedTypes.includes(type)
      ? selectedTypes.filter((selected) => selected !== type)
      : typeOptions
          .map((option) => option.value)
          .filter((value) => value === type || selectedTypes.includes(value));
    onTypesChange(next);
  };

  return (
    <>
      <PageHeader
        title={<Trans>Trash</Trans>}
        subtitle={
          <Trans>
            Items a recent scan couldn't find, because the file is missing or
            the media server no longer returns them. They can't play in
            channels. Emptying the trash replaces them with flex.
          </Trans>
        }
        actions={
          <Button
            variant="contained"
            color="error"
            startIcon={<Delete />}
            disabled={drain.state !== 'idle'}
            onClick={onEmptyTrash}
          >
            <Trans>Empty Trash</Trans>
          </Button>
        }
      />
      {(drain.state === 'running' || drain.state === 'cancelling') && (
        <DrainProgress
          deleted={drain.deleted}
          total={drain.total}
          cancelling={drain.state === 'cancelling'}
          onCancel={onCancel}
        />
      )}
      <Stack
        direction="row"
        flexWrap="wrap"
        gap={1}
        role="group"
        aria-label={t`Item types`}
        sx={{ mb: 2 }}
      >
        <FilterChip
          label={<Trans>All</Trans>}
          selected={selectedTypes.length === 0}
          onClick={() => onTypesChange([])}
        />
        {typeOptions.map((option) => (
          <FilterChip
            key={option.value}
            label={option.label}
            icon={option.icon}
            selected={selectedTypes.includes(option.value)}
            onClick={() => toggleType(option.value)}
          />
        ))}
      </Stack>
      {children}
    </>
  );
};
