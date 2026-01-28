import { Edit } from '@mui/icons-material';
import { Stack } from '@mui/material';
import type { Schedule, ScheduleSlot } from '@tunarr/types/api';
import type { MRT_ColumnDef } from 'material-react-table';
import {
  MaterialReactTable,
  useMaterialReactTable,
} from 'material-react-table';
import { useMemo } from 'react';
import {
  RouterButtonLink,
  RouterIconButtonLink,
} from '../../components/base/RouterButtonLink.tsx';

type Props = {
  schedule: Schedule;
};

export const ScheduleSlotTable = ({ schedule }: Props) => {
  const columns = useMemo((): MRT_ColumnDef<ScheduleSlot>[] => {
    return [
      {
        header: 'Type',
        accessorKey: 'type',
      },
    ];
  }, []);

  const table = useMaterialReactTable({
    data: schedule.slots,
    columns,
    positionActionsColumn: 'last',
    enableRowActions: true,
    // TODO: Can enable this with custom options to filter by show name
    enableGlobalFilter: false,
    enableFullScreenToggle: false,
    enableRowDragging: true,
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
    muiRowDragHandleProps: ({ table }) => ({
      onDragEnd: () => {
        // const { draggingRow, hoveredRow } = table.getState();
        // if (hoveredRow && draggingRow && !isUndefined(hoveredRow.index)) {
        //   prefFields.swap(hoveredRow.index, draggingRow.index);
        // }
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

  return <MaterialReactTable table={table} />;
};
