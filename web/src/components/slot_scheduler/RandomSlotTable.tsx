import { AddRandomSlotButton } from '@/components/slot_scheduler/AddRandomSlotButton2.tsx';
import { ClearSlotsButton } from '@/components/slot_scheduler/ClearSlotsButton.tsx';
import { EditRandomSlotDialogContent } from '@/components/slot_scheduler/EditRandomSlotDialogContent';
import { RandomSlotWarningsDialog } from '@/components/slot_scheduler/RandomSlotWarningsDialog';
import {
  RandomSlotTableRowType,
  SlotWarning,
} from '@/components/slot_scheduler/SlotTypes.ts';
import { betterHumanize } from '@/helpers/dayjs';
import { getRandomSlotId } from '@/helpers/slotSchedulerUtil.ts';
import { useSlotProgramOptions } from '@/hooks/programming_controls/useSlotProgramOptions.ts';
import { useScheduledSlotProgramDetails } from '@/hooks/slot_scheduler/useScheduledSlotProgramDetails';
import { useRandomSlotFormContext } from '@/hooks/useRandomSlotFormContext.ts';
import { Warning } from '@mui/icons-material';
import Delete from '@mui/icons-material/Delete';
import Edit from '@mui/icons-material/Edit';
import { Dialog, DialogTitle, IconButton, Stack, Tooltip } from '@mui/material';
import { RandomSlot, RandomSlotProgramming } from '@tunarr/types/api';
import dayjs from 'dayjs';
import {
  capitalize,
  filter,
  find,
  isEmpty,
  isNil,
  map,
  nth,
  uniq,
} from 'lodash-es';
import {
  MRT_ColumnDef,
  MRT_Row,
  MRT_TableInstance,
  MaterialReactTable,
  useMaterialReactTable,
} from 'material-react-table';
import pluralize from 'pluralize';
import { useMemo, useState } from 'react';

export const RandomSlotTable = () => {
  const { slotArray } = useRandomSlotFormContext();
  const programOptions = useSlotProgramOptions();

  const slotIds = useMemo(
    () =>
      uniq(map(slotArray.fields, (slot) => getRandomSlotId(slot.programming))),
    [slotArray.fields],
  );

  const [currentEditingSlot, setCurrentEditingSlot] = useState<{
    slot: RandomSlot;
    index: number;
  } | null>(null);

  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 25,
  });

  const [currentSlotWarningsIndex, setCurrentSlotWarningsIndex] = useState<
    number | null
  >(null);

  const columns = useMemo<MRT_ColumnDef<RandomSlotTableRowType>[]>(() => {
    return [
      {
        header: '',
        muiTableBodyCellProps: () => ({
          sx: {
            textAlign: 'center',
          },
        }),
        id: 'status',
        Cell: ({ row }) => {
          if (!isEmpty(row.original.warnings)) {
            const len = row.original.warnings.length;
            return (
              <Tooltip
                title={`There ${pluralize('is', len)} ${len} ${pluralize(
                  'warning',
                  len,
                )}. Click for details.`}
              >
                <IconButton
                  onClick={() => setCurrentSlotWarningsIndex(row.index)}
                  size="small"
                  sx={{ fontSize: '1rem', py: 0 }}
                  disableRipple
                >
                  <Warning sx={{ fontSize: 'inherit' }} color="warning" />
                </IconButton>
              </Tooltip>
            );
          }
          return null;
        },
        size: 40,
        enableHiding: false,
        enableColumnActions: false,
      },
      {
        header: 'Duration',
        accessorKey: 'durationMs',
        Cell: ({ cell }) => {
          const value = cell.getValue<number>();
          return betterHumanize(dayjs.duration(value), {
            exact: true,
            style: 'full',
          });
        },
        size: 100,
        grow: false,
      },
      {
        header: 'Program',
        accessorKey: 'programming',
        enableEditing: true,
        Cell: ({ cell }) => {
          const value = cell.getValue<RandomSlotProgramming>();
          switch (value.type) {
            case 'movie':
              return 'Movie';
            case 'show':
              return find(programOptions, { showId: value.showId })
                ?.description;
            case 'flex':
              return 'Flex';
            case 'redirect':
              return find(programOptions, { channelId: value.channelId })
                ?.description;
            case 'custom-show':
              return find(programOptions, { customShowId: value.customShowId })
                ?.description;
          }
        },
        grow: true,
        size: 350,
      },
      {
        header: 'Order',
        accessorFn(originalRow) {
          switch (originalRow.programming.type) {
            case 'movie':
            case 'flex':
            case 'redirect':
              return null;
            case 'show':
            case 'custom-show':
              return capitalize(originalRow.order);
          }
        },
        id: 'programOrder',
        Cell({ cell }) {
          const value = cell.getValue<RandomSlot['order'] | null>();
          if (!value) {
            return '-';
          }
          return value;
        },
        enableSorting: false,
      },
    ];
  }, [programOptions]);

  const renderActionCell = ({
    row,
  }: {
    row: MRT_Row<RandomSlotTableRowType>;
    table: MRT_TableInstance<RandomSlotTableRowType>;
  }) => {
    return (
      <>
        <Tooltip title="Edit Slot" placement="top">
          <IconButton
            onClick={() =>
              setCurrentEditingSlot({
                slot: row.original,
                index: row.index,
              })
            }
          >
            <Edit />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete Slot" placement="top">
          <IconButton onClick={() => slotArray.remove(row.index)}>
            <Delete />
          </IconButton>
        </Tooltip>
      </>
    );
  };

  const detailsBySlotId = useScheduledSlotProgramDetails(slotIds);

  const rows = useMemo<RandomSlotTableRowType[]>(() => {
    return map(slotArray.fields, (slot) => {
      const warnings: SlotWarning[] = [];
      const slotId = getRandomSlotId(slot.programming);
      const slotDetails = detailsBySlotId[slotId];
      let programCount = 0;
      if (slotDetails) {
        const overDuration = filter(
          slotDetails.programDurations,
          ({ duration }) => duration > slot.durationMs,
        );

        if (overDuration.length > 0) {
          warnings.push({
            type: 'program_too_long',
            programs: overDuration,
          });
        }

        programCount = slotDetails.programCount;
      }
      return {
        ...slot,
        programCount,
        warnings,
      } satisfies RandomSlotTableRowType;
    });
  }, [detailsBySlotId, slotArray.fields]);

  const table = useMaterialReactTable({
    columns,
    data: rows,
    getRowId: (row) => row.id,
    displayColumnDefOptions: {
      'mrt-row-actions': {
        grow: false,
        Header: '',
        visibleInShowHideMenu: false,
      },
    },
    positionActionsColumn: 'last',
    enableRowActions: true,
    // TODO: Can enable this with custom options to filter by show name
    enableGlobalFilter: false,
    enableFullScreenToggle: false,
    renderRowActions: renderActionCell,
    renderTopToolbarCustomActions() {
      return (
        <Stack direction="row" alignItems="center" gap={2} useFlexGap>
          <AddRandomSlotButton
            onAdd={(slot) =>
              setCurrentEditingSlot({ slot, index: slotArray.fields.length })
            }
            programOptions={programOptions}
          />
          <ClearSlotsButton
            fields={slotArray.fields}
            remove={slotArray.remove}
          />
        </Stack>
      );
    },
    initialState: {
      density: 'compact',
    },
    autoResetPageIndex: false,
    onPaginationChange: setPagination,
    state: {
      pagination,
    },
  });

  return (
    <>
      <MaterialReactTable table={table} />
      <Dialog
        maxWidth="sm"
        open={!!currentEditingSlot}
        fullWidth
        onClose={() => setCurrentEditingSlot(null)}
      >
        <DialogTitle>Edit Slot</DialogTitle>
        {currentEditingSlot && (
          <EditRandomSlotDialogContent
            slot={currentEditingSlot.slot}
            index={currentEditingSlot.index}
            programOptions={programOptions}
            onClose={() => setCurrentEditingSlot(null)}
          />
        )}
      </Dialog>
      <RandomSlotWarningsDialog
        slot={
          !isNil(currentSlotWarningsIndex)
            ? nth(rows, currentSlotWarningsIndex)
            : undefined
        }
        onClose={() => setCurrentSlotWarningsIndex(null)}
      />
    </>
  );
};
