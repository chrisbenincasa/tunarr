import { betterHumanize } from '@/helpers/dayjs.ts';
import { useThemeTokens } from '@/hooks/useTunarrTheme.ts';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { Add, Edit, SettingsRemote } from '@mui/icons-material';
import { Box, LinearProgress, Stack, Tooltip, Typography } from '@mui/material';
import type { Channel } from '@tunarr/types';
import dayjs from 'dayjs';
import { type ReactNode, useMemo } from 'react';
import {
  RouterButtonLink,
  RouterIconButtonLink,
} from '../base/RouterButtonLink.tsx';
import { RouterLink } from '../base/RouterLink.tsx';
import { EmptyState } from '../ui/EmptyState.tsx';
import { MonoText } from '../ui/MonoText.tsx';
import { PageHeader } from '../ui/PageHeader.tsx';
import {
  CollectionView,
  type CollectionLayout,
} from '../ui/patterns/CollectionView/index.ts';
import { DataTable } from '../ui/table/DataTable.tsx';
import { actionsColumn } from '../ui/table/columns.tsx';
import {
  createAppColumnHelper,
  useTunarrTable,
} from '../ui/table/tunarrTable.ts';
import { useStoreBackedTableSettings } from '../ui/table/useStoreBackedTableSettings.ts';
import { ChannelCard } from './ChannelCard.tsx';
import { ChannelIconDisplay } from './ChannelIconDisplay.tsx';
import { ChannelStatusPill } from './ChannelStatusPill.tsx';
import { channelStatus, type NowPlayingSummary } from './channelSummary.ts';

export type TranscodeConfigRef = { id: string; name: string };

export type ChannelsViewProps = {
  channels: Channel[];
  nowPlaying: ReadonlyMap<string, NowPlayingSummary>;
  transcodeConfigs: readonly TranscodeConfigRef[];
  onOpenChannel: (channel: Channel) => void;
  onOpenSessions: (channel: Channel) => void;

  // Overflow menu for one channel. `place` says which layout shows it, so the
  // menu can leave out actions that layout already shows as buttons.
  renderMenu: (channel: Channel, place: CollectionLayout) => ReactNode;
  layout?: CollectionLayout;
};

const columnHelper = createAppColumnHelper<Channel>();

const humanDuration = (ms: number) =>
  betterHumanize(dayjs.duration(ms), { style: 'short' });

export const ChannelsView = ({
  channels,
  nowPlaying,
  transcodeConfigs,
  onOpenChannel,
  onOpenSessions,
  renderMenu,
  layout,
}: ChannelsViewProps) => {
  const { t } = useLingui();
  const { tokens } = useThemeTokens();
  const tableState = useStoreBackedTableSettings('Channels');

  const transcodeById = useMemo(
    () => new Map(transcodeConfigs.map((c) => [c.id, c])),
    [transcodeConfigs],
  );

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('number', {
          header: t`Number`,
          meta: { numeric: true, filterVariant: 'range', width: 96 },
        }),
        columnHelper.accessor('name', {
          header: t`Name`,
          cell: ({ row: { original: channel } }) => (
            <Stack direction="row" alignItems="center" gap={1.25}>
              <Box
                aria-hidden
                sx={{ flex: 'none', display: 'flex', width: 28, height: 22 }}
              >
                <ChannelIconDisplay
                  icon={channel.icon}
                  imgStyle={{ maxHeight: 22, maxWidth: 28 }}
                  style={{ width: 28, height: 22 }}
                />
              </Box>
              <Box component="span" sx={{ fontWeight: 600 }}>
                {channel.name}
              </Box>
            </Stack>
          ),
        }),
        columnHelper.accessor(
          (channel) => nowPlaying.get(channel.id)?.title ?? '',
          {
            id: 'nowPlaying',
            header: t`Now playing`,
            enableSorting: false,
            cell: ({ row: { original: channel } }) => {
              const now = nowPlaying.get(channel.id);
              if (!now) {
                return '—';
              }
              const title =
                now.kind === 'redirect'
                  ? t`Redirect to channel ${now.redirectChannel}`
                  : now.title;
              return (
                <Box sx={{ maxWidth: 280 }}>
                  <Typography noWrap sx={{ fontSize: 'inherit' }}>
                    {title}{' '}
                    {now.code && (
                      <Box component="span" sx={{ color: tokens.textMuted }}>
                        {now.code}
                      </Box>
                    )}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={now.progress * 100}
                    aria-label={t`Program progress`}
                    sx={{
                      mt: 0.5,
                      height: 2,
                      borderRadius: 0,
                      backgroundColor: tokens.borderStrong,
                    }}
                  />
                </Box>
              );
            },
          },
        ),
        columnHelper.accessor(
          (channel) => channelStatus(channel.sessions).connections,
          {
            id: 'sessions',
            header: t`Status`,
            enableColumnFilter: false,
            cell: ({ row: { original: channel } }) => (
              <ChannelStatusPill
                status={channelStatus(channel.sessions)}
                onOpenSessions={() => onOpenSessions(channel)}
              />
            ),
          },
        ),
        columnHelper.accessor('programCount', {
          header: t`# Programs`,
          meta: { numeric: true, filterVariant: 'range' },
        }),
        columnHelper.accessor('duration', {
          header: t`Duration`,
          enableColumnFilter: false,
          cell: ({ getValue }) => humanDuration(getValue()),
          meta: { numeric: true },
        }),
        columnHelper.accessor(
          (channel) => transcodeById.get(channel.transcodeConfigId)?.name ?? '',
          {
            id: 'transcodeConfigId',
            header: t`Transcode Config`,
            cell: ({ row: { original: channel } }) => {
              const config = transcodeById.get(channel.transcodeConfigId);
              if (!config) {
                return '—';
              }
              return (
                <RouterLink
                  to="/profiles/transcode/$configId"
                  params={{ configId: config.id }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {config.name}
                </RouterLink>
              );
            },
          },
        ),
        columnHelper.accessor('stealth', {
          header: t`Stealth`,
          enableSorting: false,
          filterFn: 'equals',
          cell: ({ getValue }) => (getValue() ? t`Yes` : t`No`),
          meta: { filterVariant: 'boolean' },
        }),
        columnHelper.accessor((channel) => channel.onDemand.enabled, {
          id: 'onDemand',
          header: t`On-Demand`,
          enableSorting: false,
          filterFn: 'equals',
          cell: ({ getValue }) => (getValue() ? t`Yes` : t`No`),
          meta: { filterVariant: 'boolean' },
        }),
        actionsColumn<Channel>({
          render: ({ original: channel }) => (
            <>
              <Tooltip title={t`Edit Channel Settings`} placement="top">
                <RouterIconButtonLink
                  to="/channels/$channelId/edit"
                  params={{ channelId: channel.id }}
                  aria-label={t`Edit Channel Settings`}
                >
                  <Edit />
                </RouterIconButtonLink>
              </Tooltip>
              {renderMenu(channel, 'table')}
            </>
          ),
        }),
      ]),
    [t, tokens, nowPlaying, transcodeById, onOpenSessions, renderMenu],
  );

  const table = useTunarrTable({
    columns,
    data: channels,
    ...tableState,
  });

  const streaming = channels.filter(
    (c) => channelStatus(c.sessions).status === 'live',
  ).length;

  const empty = (
    <EmptyState
      icon={<SettingsRemote />}
      title={<Trans>You haven't created any channels yet.</Trans>}
      actions={
        <RouterButtonLink to="/channels/new" variant="contained">
          <Trans>Create a Channel</Trans>
        </RouterButtonLink>
      }
    />
  );

  return (
    <>
      <PageHeader
        title={<Trans>Channels</Trans>}
        subtitle={
          <>
            <MonoText>{channels.length}</MonoText>{' '}
            <Plural value={channels.length} one="channel" other="channels" /> ·{' '}
            <MonoText>{streaming}</MonoText> <Trans>streaming</Trans>
          </>
        }
        actions={
          <RouterButtonLink
            to="/channels/new"
            variant="contained"
            startIcon={<Add />}
          >
            <Trans>New Channel</Trans>
          </RouterButtonLink>
        }
      />
      <CollectionView
        aria-label={t`Channels`}
        layout={layout}
        items={channels}
        getItemKey={(channel) => channel.id}
        empty={empty}
        pagination={{
          state: tableState.state.pagination,
          onChange: tableState.onPaginationChange,
        }}
        renderCard={(channel) => (
          <ChannelCard
            channel={channel}
            status={channelStatus(channel.sessions)}
            nowPlaying={nowPlaying.get(channel.id)}
            transcodeName={transcodeById.get(channel.transcodeConfigId)?.name}
            onOpenSessions={() => onOpenSessions(channel)}
            menu={renderMenu(channel, 'cards')}
          />
        )}
        table={
          <DataTable
            table={table}
            aria-label={t`Channels`}
            emptyFallback={empty}
            getRowProps={(row) => ({
              onClick: () => onOpenChannel(row.original),
            })}
          />
        }
      />
    </>
  );
};
