import { betterHumanize } from '@/helpers/dayjs.ts';
import { useThemeTokens } from '@/hooks/useTunarrTheme.ts';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import {
  Add,
  ContentCopy,
  Delete,
  Download,
  Edit,
  PlaylistAdd,
  SettingsRemote,
} from '@mui/icons-material';
import {
  Box,
  Button,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import type { RowSelectionState } from '@tanstack/react-table';
import type { Channel } from '@tunarr/types';
import dayjs from 'dayjs';
import { type ReactNode, useMemo, useState } from 'react';
import {
  RouterButtonLink,
  RouterIconButtonLink,
} from '../base/RouterButtonLink.tsx';
import { RouterLink } from '../base/RouterLink.tsx';
import { EmptyState } from '../ui/EmptyState.tsx';
import { MonoText } from '../ui/MonoText.tsx';
import { PageHeader } from '../ui/PageHeader.tsx';
import { Segmented } from '../ui/Segmented.tsx';
import {
  CollectionView,
  SelectionBar,
  type CollectionLayout,
} from '../ui/patterns/CollectionView/index.ts';
import { DataTable } from '../ui/table/DataTable.tsx';
import { actionsColumn, selectColumn } from '../ui/table/columns.tsx';
import {
  createAppColumnHelper,
  useTunarrTable,
} from '../ui/table/tunarrTable.ts';
import { useStoreBackedTableSettings } from '../ui/table/useStoreBackedTableSettings.ts';
import { ChannelCard } from './ChannelCard.tsx';
import { ChannelIconDisplay } from './ChannelIconDisplay.tsx';
import { ChannelStatusPill } from './ChannelStatusPill.tsx';
import { ChannelsDeleteDialog } from './ChannelsDeleteDialog.tsx';
import {
  type ChannelStatusFilter,
  channelStatus,
  channelsM3uUrl,
  matchesStatusFilter,
  type NowPlayingSummary,
} from './channelSummary.ts';

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

  // The full playlist's URL. Bulk export adds the selected channel numbers.
  m3uUrl: string;
  onDuplicateChannels: (channels: Channel[]) => void;
  onAssignFillers: (channels: Channel[]) => void;

  // Called after the user confirms.
  onDeleteChannels: (channels: Channel[]) => void;
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
  m3uUrl,
  onDuplicateChannels,
  onAssignFillers,
  onDeleteChannels,
  layout,
}: ChannelsViewProps) => {
  const { t } = useLingui();
  const { tokens } = useThemeTokens();
  const tableState = useStoreBackedTableSettings('Channels');
  const [statusFilter, setStatusFilter] = useState<ChannelStatusFilter>('all');
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pendingDelete, setPendingDelete] = useState<Channel[] | null>(null);

  const visibleChannels = useMemo(
    () => channels.filter((c) => matchesStatusFilter(c, statusFilter)),
    [channels, statusFilter],
  );

  // Selection only counts channels that pass the status filter, so deleted or
  // filtered channels never reach a bulk action. DataTable drops rows its own
  // search and column filters hide.
  const selected = visibleChannels.filter((c) => rowSelection[c.id]);

  const keyboardNavigation = useMemo(
    () => ({
      onOpen: (row: { original: Channel }) => onOpenChannel(row.original),
    }),
    [onOpenChannel],
  );

  const transcodeById = useMemo(
    () => new Map(transcodeConfigs.map((c) => [c.id, c])),
    [transcodeConfigs],
  );

  const columns = useMemo(
    () =>
      columnHelper.columns([
        selectColumn<Channel>({ getLabel: (channel) => channel.name }),
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
    data: visibleChannels,
    getRowId: (channel) => channel.id,
    ...tableState,
    state: { ...tableState.state, rowSelection },
    onRowSelectionChange: setRowSelection,
  });

  const channelCount = channels.length;
  const streaming = channels.filter(
    (c) => channelStatus(c.sessions).status === 'live',
  ).length;

  const empty =
    channels.length === 0 ? (
      <EmptyState
        icon={<SettingsRemote />}
        title={<Trans>You haven't created any channels yet.</Trans>}
        actions={
          <RouterButtonLink to="/channels/new" variant="contained">
            <Trans>Create a Channel</Trans>
          </RouterButtonLink>
        }
      />
    ) : (
      <EmptyState
        icon={<SettingsRemote />}
        title={<Trans>No channels match this filter.</Trans>}
        actions={
          <Button variant="outlined" onClick={() => setStatusFilter('all')}>
            <Trans>Show all channels</Trans>
          </Button>
        }
      />
    );

  const bulkActions = (
    <>
      <Button
        size="small"
        variant="outlined"
        startIcon={<ContentCopy />}
        onClick={() => onDuplicateChannels(selected)}
      >
        <Trans>Duplicate</Trans>
      </Button>
      <Button
        size="small"
        variant="outlined"
        startIcon={<PlaylistAdd />}
        onClick={() => onAssignFillers(selected)}
      >
        <Trans>Assign fillers</Trans>
      </Button>
      <Button
        size="small"
        variant="outlined"
        startIcon={<Download />}
        href={channelsM3uUrl(
          m3uUrl,
          selected.map((c) => c.number),
        )}
        download="channels.m3u"
      >
        <Trans>Export M3U</Trans>
      </Button>
      <Button
        size="small"
        variant="outlined"
        color="error"
        startIcon={<Delete />}
        onClick={() => setPendingDelete(selected)}
      >
        <Trans>Delete</Trans>
      </Button>
    </>
  );

  return (
    <>
      <PageHeader
        title={<Trans>Channels</Trans>}
        subtitle={
          <Trans>
            <MonoText>{channelCount}</MonoText>{' '}
            <Plural value={channelCount} one="channel" other="channels" /> ·{' '}
            <MonoText>{streaming}</MonoText> streaming
          </Trans>
        }
        actions={
          <Stack
            direction="row"
            sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}
          >
            <Segmented
              aria-label={t`Status filter`}
              value={statusFilter}
              onChange={(next) => {
                setStatusFilter(next);
                setRowSelection({});
              }}
              options={[
                { value: 'all', label: t`All` },
                { value: 'streaming', label: t`Streaming` },
                { value: 'stealth', label: t`Stealth` },
              ]}
            />
            <Button
              variant="outlined"
              startIcon={<Download />}
              href={channelsM3uUrl(m3uUrl)}
              download="channels.m3u"
            >
              <Trans>Export M3U</Trans>
            </Button>
            <RouterButtonLink
              to="/channels/new"
              variant="contained"
              startIcon={<Add />}
            >
              <Trans>New Channel</Trans>
            </RouterButtonLink>
          </Stack>
        }
      />
      <CollectionView
        aria-label={t`Channels`}
        layout={layout}
        items={visibleChannels}
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
          <>
            <SelectionBar
              count={selected.length}
              actions={bulkActions}
              onClear={() => setRowSelection({})}
              keyboardHints
            />
            <DataTable
              table={table}
              aria-label={t`Channels`}
              emptyFallback={empty}
              keyboardNavigation={keyboardNavigation}
              getRowProps={(row) => ({
                onClick: () => onOpenChannel(row.original),
              })}
            />
          </>
        }
      />
      <ChannelsDeleteDialog
        channels={pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            onDeleteChannels(pendingDelete);
          }
          setPendingDelete(null);
          setRowSelection({});
        }}
      />
    </>
  );
};
