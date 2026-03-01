import { Edit } from '@mui/icons-material';
import { Stack } from '@mui/material';
import { prettifySnakeCaseString } from '@tunarr/shared/util';
import type {
  MaterializedSchedule2,
  MaterializedScheduleSlot,
  Schedule,
} from '@tunarr/types/api';
import { capitalize, identity } from 'lodash-es';
import type { MRT_ColumnDef } from 'material-react-table';
import {
  MaterialReactTable,
  useMaterialReactTable,
} from 'material-react-table';
import { useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { match } from 'ts-pattern';
import {
  RouterButtonLink,
  RouterIconButtonLink,
} from '../../components/base/RouterButtonLink.tsx';

type Props = {
  schedule: MaterializedSchedule2;
};

export const ScheduleSlotTable = ({ schedule }: Props) => {
  const scheduleForm = useFormContext<Schedule>();
  const [slotPlaybackOrder] = scheduleForm.watch(['slotPlaybackOrder']);

  const columns = useMemo((): MRT_ColumnDef<MaterializedScheduleSlot>[] => {
    return [
      {
        header: 'Type',
        accessorKey: 'type',
        Cell: ({ cell }) => {
          return prettifySnakeCaseString(cell.getValue<string>());
        },
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
            .with({ type: 'movie' }, () => 'Movie')
            .with({ type: 'filler' }, () => 'Filler')
            .with({ type: 'redirect' }, (r) => r.channel?.name)
            .exhaustive();
        },
        grow: true,
        size: 350,
      },
      {
        header: 'Mode',
        accessorKey: 'fillMode',
        Cell({ cell }) {
          return capitalize(cell.getValue<string>());
        },
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
    enableRowDragging: slotPlaybackOrder === 'ordered',
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
    muiRowDragHandleProps: () => ({
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
