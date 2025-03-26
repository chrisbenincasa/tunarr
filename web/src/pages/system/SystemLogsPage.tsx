import { Download } from '@mui/icons-material';
import { Button, Stack, Typography } from '@mui/material';
import type { TupleToUnion } from '@tunarr/types';
import { attempt, isString } from 'lodash-es';
import type { MRT_ColumnDef } from 'material-react-table';
import {
  MaterialReactTable,
  useMaterialReactTable,
} from 'material-react-table';
import pluralize from 'pluralize';
import { useEffect, useMemo, useRef, useState } from 'react';
import PaddedPaper from '../../components/base/PaddedPaper.tsx';
import { isNonEmptyString } from '../../helpers/util.ts';
import { useDownload } from '../../hooks/useDownload.ts';
import { useSettings } from '../../store/settings/selectors.ts';

const LogPattern = /([0-9\-:.A-Z]+)\s*\[([a-z]+)\]\s*(<(.*)>:)?(.*)/;
const JsonAddition = /\{(.*)\}/;

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

type LogLine = {
  fullLine: string;
  message: string;
  timestamp: string;
  level: TupleToUnion<typeof ValidLogLevels>;
  component?: string;
  extraData?: unknown;
};

export function SystemLogsPage() {
  const { backendUri } = useSettings();
  const source = useRef<EventSource | null>(null);
  const [logBuf, setLogBuf] = useState<LogLine[]>([]);
  const download = useDownload();

  useEffect(() => {
    let es: EventSource | undefined;
    if (!source.current) {
      es = new EventSource(`${backendUri}/api/system/debug/logs`);
      source.current = es;

      es.addEventListener('message', (data) => {
        if (isString(data.data)) {
          const fullLine = data.data;
          const parseResult = LogPattern.exec(data.data);
          const date = parseResult?.[1];
          const level = parseResult?.[2];
          const component = parseResult?.[4];
          const rest = parseResult?.[5];
          let extraData: unknown;
          if (isNonEmptyString(rest)) {
            const jsonExtraData = JsonAddition.exec(rest);
            if (jsonExtraData) {
              extraData = attempt(
                () => JSON.parse(jsonExtraData[0]) as unknown,
              );
            }
          }

          if (date && level && isValidLogLevel(level)) {
            setLogBuf((prev) => {
              const n = [
                {
                  fullLine,
                  timestamp: date,
                  level,
                  component,
                  extraData,
                  message: (rest ?? '').replace(/^:\s*/, ''),
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
          disabled={table.getPrePaginationRowModel().rows.length === 0}
          onClick={() =>
            download(
              table
                .getPrePaginationRowModel()
                .rows.map((row) => row.original.fullLine)
                .join('\n'),
              `tunarr_last_N_logs.txt`,
              'text/plain',
            )
          }
        >
          Download last {table.getRowCount()}{' '}
          {pluralize('row', table.getRowCount())}
        </Button>
        <Button
          startIcon={<Download />}
          component="a"
          href={`${backendUri}/api/system/debug/logs?download=true`}
        >
          Download all logs
        </Button>
      </Stack>
    ),
  });

  return (
    <PaddedPaper>
      <Typography>
        Displays the last {logBuf.length} system log events. Use the buttons
        below to export these logs or download the entire log file for
        debugging.
      </Typography>
      <MaterialReactTable table={table} />
    </PaddedPaper>
  );
}
