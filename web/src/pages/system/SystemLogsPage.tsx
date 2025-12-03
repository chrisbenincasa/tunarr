import { Download } from '@mui/icons-material';
import { Button, Stack, Typography } from '@mui/material';
import type { TupleToUnion } from '@tunarr/types';
import { attempt, isError, isNil, isObject, isString } from 'lodash-es';
import type { MRT_ColumnDef } from 'material-react-table';
import {
  MaterialReactTable,
  useMaterialReactTable,
} from 'material-react-table';
import pluralize from 'pluralize';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSettings } from '../../store/settings/selectors.ts';

const ValidLogLevels = [
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
  'http',
];

function isValidLogLevel(s: string): s is TupleToUnion<typeof ValidLogLevels> {
  return ValidLogLevels.includes(s);
}

function getLogLevelString(
  level: number,
): TupleToUnion<typeof ValidLogLevels> | null {
  switch (level) {
    case 10:
      return 'trace';
    case 20:
      return 'debug';
    case 25:
      return 'http';
    case 30:
      return 'info';
    case 40:
      return 'warn';
    case 50:
      return 'error';
    case 60:
      return 'fatal';
    default:
      return null;
  }
}

type LogLine = {
  fullLine: string;
  message: string;
  timestamp: string;
  level: TupleToUnion<typeof ValidLogLevels>;
  component?: string;
  extraData?: unknown;
};

type ParsedLogLine = {
  level: number;
  caller?: string;
  msg: string;
  time: number;
};

export function SystemLogsPage() {
  const { backendUri } = useSettings();
  const source = useRef<EventSource | null>(null);
  const [logBuf, setLogBuf] = useState<LogLine[]>([]);

  useEffect(() => {
    let es: EventSource | undefined;
    if (!source.current) {
      es = new EventSource(`${backendUri}/api/system/debug/logs`);
      source.current = es;

      es.addEventListener('message', ({ data }) => {
        if (isString(data)) {
          const parsed = attempt(
            () => JSON.parse(data) as unknown as ParsedLogLine,
          );
          if (isError(parsed) || isNil(parsed) || !isObject(parsed)) {
            return;
          }

          const date = new Date(parsed.time);
          const level = getLogLevelString(parsed.level);
          const component = parsed.caller;

          if (date && level && isValidLogLevel(level)) {
            setLogBuf((prev) => {
              const n = [
                {
                  fullLine: data,
                  timestamp: date.toISOString(),
                  level,
                  component,
                  message: parsed.msg,
                } satisfies LogLine,
                ...prev,
              ];
              const rem = n.length - 1000;
              if (rem <= 0) {
                return n;
              }

              return n.slice(0, 1000);
            });
          }
        }
      });
    }

    return () => {
      source.current = null;
      // listeners.current = {};
      es?.close();
    };
  }, [backendUri, source]);

  const columns = useMemo<MRT_ColumnDef<LogLine>[]>(() => {
    return [
      {
        accessorKey: 'timestamp',
        header: 'Timestamp',
      },
      {
        accessorKey: 'level',
        header: 'Level',
        filterVariant: 'multi-select',
        filterSelectOptions: ValidLogLevels,
      },
      {
        accessorKey: 'component',
        header: 'Component',
      },
      {
        accessorKey: 'message',
        header: 'Message',
      },
    ];
  }, []);

  const table = useMaterialReactTable({
    columns,
    data: logBuf,
    initialState: {
      density: 'compact',
      pagination: {
        pageSize: 50,
        pageIndex: 0,
      },
    },
    renderTopToolbarCustomActions: ({ table }) => (
      <Stack direction="row" gap={2}>
        <Button
          startIcon={<Download />}
          component="a"
          href={`${backendUri}/api/system/debug/logs?download=true&pretty=true&lineLimit=${table.getRowCount()}`}
        >
          Download last {table.getRowCount()}{' '}
          {pluralize('row', table.getRowCount())}
        </Button>
        <Button
          startIcon={<Download />}
          component="a"
          href={`${backendUri}/api/system/debug/logs?download=true&pretty=true`}
        >
          Download all logs
        </Button>
      </Stack>
    ),
  });

  return (
    <>
      <Typography sx={{ pb: 2 }}>
        Displays the last {logBuf.length} system log events. Use the buttons
        below to export these logs or download the entire log file for
        debugging.
      </Typography>
      <MaterialReactTable table={table} />
    </>
  );
}
