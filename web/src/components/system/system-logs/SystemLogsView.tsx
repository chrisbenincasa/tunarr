import { useDayjs } from '@/hooks/useDayjs.ts';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { Article, Download, Pause, PlayArrow } from '@mui/icons-material';
import { Box, Button, Stack, useMediaQuery, useTheme } from '@mui/material';
import { useCallback, useMemo } from 'react';
import { EmptyState } from '../../ui/EmptyState.tsx';
import { MonoText } from '../../ui/MonoText.tsx';
import { PageHeader } from '../../ui/PageHeader.tsx';
import { StatusPill } from '../../ui/StatusPill.tsx';
import {
  CollectionView,
  type CollectionLayout,
} from '../../ui/patterns/CollectionView/index.ts';
import { DataTable } from '../../ui/table/DataTable.tsx';
import { expandColumn } from '../../ui/table/columns.tsx';
import {
  createAppColumnHelper,
  useTunarrTable,
} from '../../ui/table/tunarrTable.ts';
import { useStoreBackedTableSettings } from '../../ui/table/useStoreBackedTableSettings.ts';
import { LogDetail } from './LogDetail.tsx';
import { LogEntry } from './LogEntry.tsx';
import { LogLevelPill } from './LogLevelPill.tsx';
import { LogLevels, type LogLine } from './logLine.ts';

export type SystemLogsViewProps = {
  // Newest first.
  lines: LogLine[];
  paused: boolean;

  // Lines that arrived since the user paused. They show on resume.
  newWhilePaused: number;
  onTogglePause: () => void;

  // The log file download. Without a limit it covers the whole file.
  downloadUrl: (lineLimit?: number) => string;
  layout?: CollectionLayout;
};

const columnHelper = createAppColumnHelper<LogLine>();

export const SystemLogsView = ({
  lines,
  paused,
  newWhilePaused,
  onTogglePause,
  downloadUrl,
  layout,
}: SystemLogsViewProps) => {
  const { t } = useLingui();
  const dayjs = useDayjs();
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  const tableState = useStoreBackedTableSettings('SystemLogs', {
    pagination: { pageIndex: 0, pageSize: 50 },
  });

  const formatTime = useCallback(
    (time: number) => dayjs(time).format('L LTS'),
    [dayjs],
  );

  const columns = useMemo(
    () => [
      expandColumn<LogLine>({ getLabel: (line) => line.msg }),
      ...columnHelper.columns([
        columnHelper.accessor('time', {
          header: t`Time`,
          enableGlobalFilter: false,
          enableColumnFilter: false,
          cell: ({ getValue }) => (
            <MonoText
              title={new Date(getValue()).toISOString()}
              sx={{ whiteSpace: 'nowrap' }}
            >
              {formatTime(getValue())}
            </MonoText>
          ),
        }),
        columnHelper.accessor('level', {
          header: t`Level`,
          enableSorting: false,
          enableGlobalFilter: false,
          filterFn: 'arrHas',
          meta: { filterVariant: 'multi-select', filterOptions: LogLevels },
          cell: ({ getValue }) => <LogLevelPill level={getValue()} />,
        }),
        columnHelper.accessor((line) => line.caller ?? '', {
          id: 'component',
          header: t`Component`,
        }),
        columnHelper.accessor('msg', {
          header: t`Message`,
          enableSorting: false,
          enableColumnFilter: false,
          cell: ({ getValue }) => (
            <Box component="span" sx={{ overflowWrap: 'anywhere' }}>
              {getValue()}
            </Box>
          ),
        }),
      ]),
    ],
    [t, formatTime],
  );

  const table = useTunarrTable({
    columns,
    data: lines,
    getRowId: (line) => String(line.id),
    getRowCanExpand: () => true,
    // New lines change the data. Open rows stay open.
    autoResetExpanded: false,
    ...tableState,
  });

  const shownCount = table.getRowCount();

  const empty = (
    <EmptyState
      icon={<Article />}
      title={<Trans>No log lines yet</Trans>}
      description={<Trans>Lines show here as the server writes them.</Trans>}
    />
  );

  return (
    <>
      <PageHeader
        title={<Trans>Logs</Trans>}
        subtitle={
          <Trans>
            Server log lines as they arrive, newest first. Download the log file
            to attach it to a bug report.
          </Trans>
        }
        actions={
          <Stack
            direction="row"
            sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}
          >
            <StatusPill
              status={paused ? 'warning' : 'live'}
              label={
                paused ? (
                  newWhilePaused > 0 ? (
                    <Plural
                      value={newWhilePaused}
                      one="Paused, # new line"
                      other="Paused, # new lines"
                    />
                  ) : (
                    <Trans>Paused</Trans>
                  )
                ) : (
                  <Trans>Live</Trans>
                )
              }
            />
            <Button
              variant="outlined"
              startIcon={paused ? <PlayArrow /> : <Pause />}
              onClick={onTogglePause}
            >
              {paused ? <Trans>Resume</Trans> : <Trans>Pause</Trans>}
            </Button>
            <Button
              variant="outlined"
              startIcon={<Download />}
              component="a"
              href={downloadUrl(shownCount)}
              disabled={shownCount === 0}
            >
              <Plural
                value={shownCount}
                one="Download last # line"
                other="Download last # lines"
              />
            </Button>
            <Button
              variant="contained"
              startIcon={<Download />}
              component="a"
              href={downloadUrl()}
            >
              <Trans>Download all logs</Trans>
            </Button>
          </Stack>
        }
      />
      <CollectionView
        aria-label={t`Logs`}
        layout={layout ?? (phone ? 'cards' : 'table')}
        items={lines}
        getItemKey={(line) => String(line.id)}
        empty={empty}
        equalRowHeights={false}
        pagination={{
          state: tableState.state.pagination,
          onChange: tableState.onPaginationChange,
        }}
        renderCard={(line) => <LogEntry line={line} formatTime={formatTime} />}
        table={
          <DataTable
            table={table}
            aria-label={t`Logs`}
            emptyFallback={empty}
            getRowProps={(row) => ({ onClick: () => row.toggleExpanded() })}
            renderDetail={(row) => <LogDetail line={row.original} />}
          />
        }
      />
    </>
  );
};
