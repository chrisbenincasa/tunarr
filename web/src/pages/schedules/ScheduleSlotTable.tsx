import { Edit } from '@mui/icons-material';
import { Box, Stack } from '@mui/material';
import { prettifySnakeCaseString } from '@tunarr/shared/util';
import type {
  MaterializedSchedule2,
  MaterializedScheduleSlot,
  Schedule,
} from '@tunarr/types/api';
import dayjs from 'dayjs';
import { capitalize, identity } from 'lodash-es';
import type { MRT_ColumnDef } from 'material-react-table';
import {
  MaterialReactTable,
  useMaterialReactTable,
} from 'material-react-table';
import { useCallback, useMemo } from 'react';
import type { FieldArrayWithId } from 'react-hook-form';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { match } from 'ts-pattern';
import { v4 } from 'uuid';
import {
  RouterButtonLink,
  RouterIconButtonLink,
} from '../../components/base/RouterButtonLink.tsx';

type Props = {
  schedule: MaterializedSchedule2;
};

type SlotRowType = FieldArrayWithId<Schedule, 'slots'>;

export const ScheduleSlotTable = ({ schedule }: Props) => {
  const scheduleForm = useFormContext<Schedule>();
  const [slotPlaybackOrder] = scheduleForm.watch(['slotPlaybackOrder']);
  const slotArray = useFieldArray({
    control: scheduleForm.control,
    name: 'slots',
  });

  const columns = useMemo((): MRT_ColumnDef<SlotRowType>[] => {
    return [
      {
        header: 'Type',
        accessorKey: 'type',
        Cell: ({ cell }) => {
          return prettifySnakeCaseString(cell.getValue<string>());
        },
        size: 100,
        grow: false,
      },
      {
        header: 'Program',
        accessorFn: identity,
        id: 'programming',
        enableEditing: true,
        Cell: ({ cell }) => {
          return match(cell.getValue<MaterializedScheduleSlot>())
            .with({ type: 'show' }, (show) => show.show?.title)
            .with({ type: 'custom-show' }, (cs) => cs.customShow?.name)
            .with({ type: 'flex' }, () => 'Flex')
            .with(
              { type: 'smart-collection' },
              (sc) => sc.smartCollection?.name,
            )
            .with({ type: 'filler' }, () => 'Filler')
            .with({ type: 'redirect' }, (r) => r.channel?.name)
            .exhaustive();
        },
        grow: true,
        size: 350,
      },
      {
        header: 'Mode',
        id: 'fillMode',
        accessorFn: identity,
        Cell({ row: { original } }) {
          const fillMode = original.fillMode;
          return match(fillMode)
            .with('fill', () => capitalize(fillMode))
            .with(
              'count',
              () => `${capitalize(fillMode)} (${original.fillValue})`,
            )
            .with(
              'duration',
              () =>
                `${capitalize(fillMode)} (${dayjs.duration(original.fillValue).humanize()})`,
            )
            .exhaustive();
        },
      },
      {
        header: 'Start Type',
        id: 'anchorMode',
        accessorFn: identity,
        Cell({ row: { original } }) {
          const mode = original.anchorMode;
          const time = original.anchorTime;
          const days = original.anchorDays ?? [];
          if (!mode || !time) {
            return '-';
          }

          const utc = dayjs().utc();
          const dayStrs: string[] = [];
          for (const day of days) {
            dayStrs.push(utc.weekday(day).format('dd'));
          }
          const dayStr = dayStrs.length > 0 ? ` ${dayStrs.join(',')}` : '';

          const pretty = capitalize(mode);
          return `${pretty} @ ${dayjs().startOf('day').add(time).format('LT')}${dayStr}`;
        },
      },
    ];
  }, []);

  const table = useMaterialReactTable({
    data: slotArray.fields,
    columns,
    getRowId: (row) => row.uuid ?? v4(),
    enableRowActions: true,
    // TODO: Can enable this with custom options to filter by show name
    enableGlobalFilter: false,
    enableFullScreenToggle: false,
    enableRowDragging: slotPlaybackOrder === 'ordered',
    enableSorting: slotPlaybackOrder !== 'ordered',
    enableRowOrdering: slotPlaybackOrder === 'ordered',
    renderRowActions: ({ row }) => {
      return (
        <>
          <RouterIconButtonLink
            to="/schedules/$scheduleId/slots/$id"
            params={{ scheduleId: schedule.uuid, id: row.original.uuid ?? '' }}
          >
            <Edit />{' '}
          </RouterIconButtonLink>
        </>
      );
    },
    displayColumnDefOptions: {
      'mrt-row-actions': {
        grow: false,
        Header: '',
        visibleInShowHideMenu: false,
      },
    },
    muiRowDragHandleProps: ({ table }) => ({
      onDragEnd: () => {
        const { draggingRow, hoveredRow } = table.getState();
        if (hoveredRow && draggingRow) {
          slotArray.swap(hoveredRow.index!, draggingRow.index);
        }
      },
    }),
    renderTopToolbarCustomActions() {
      return (
        <Stack direction="row" alignItems="center" gap={2} useFlexGap>
          <RouterButtonLink
            to="/schedules/$scheduleId/slots/new"
            params={{ scheduleId: schedule.uuid }}
            variant="contained"
          >
            Add Slot
          </RouterButtonLink>
        </Stack>
      );
    },
    initialState: {
      density: 'compact',
    },
    autoResetPageIndex: false,
    muiTablePaperProps: (props) => ({
      ...props,
      sx: {
        p: 1,
      },
    }),
  });

  const stopBubble: React.DragEventHandler = useCallback((e) => {
    e.stopPropagation();
  }, []);

  return (
    <Box
      onDragStart={stopBubble}
      onDragEnter={stopBubble}
      onDragOver={stopBubble}
      onDrop={stopBubble}
    >
      <MaterialReactTable table={table} />
    </Box>
  );
};
