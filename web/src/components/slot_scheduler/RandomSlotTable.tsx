import { AddRandomSlotButton } from '@/components/slot_scheduler/AddRandomSlotButton';
import { ClearSlotsButton } from '@/components/slot_scheduler/ClearSlotsButton.tsx';
import { EditRandomSlotDialogContent } from '@/components/slot_scheduler/EditRandomSlotDialogContent';
import { RandomSlotPresetButton } from '@/components/slot_scheduler/RandomSlotPresetButton.tsx';
import { RandomSlotWarningsDialog } from '@/components/slot_scheduler/RandomSlotWarningsDialog';
import {
  RandomSlotsWeightAdjustDialog,
  UnlockedWeightScale,
} from '@/components/slot_scheduler/RandomSlotsWeightAdjustDialog';
import type {
  RandomSlotTableRowType,
  SlotWarning,
} from '@/components/slot_scheduler/SlotTypes.ts';
import { betterHumanize } from '@/helpers/dayjs';
import { getRandomSlotId } from '@/helpers/slotSchedulerUtil.ts';
import { useSlotProgramOptions } from '@/hooks/programming_controls/useSlotProgramOptions.ts';
import { useScheduledSlotProgramDetails } from '@/hooks/slot_scheduler/useScheduledSlotProgramDetails';
import { useRandomSlotFormContext } from '@/hooks/useRandomSlotFormContext.ts';
import { Balance, Warning } from '@mui/icons-material';
import Delete from '@mui/icons-material/Delete';
import Edit from '@mui/icons-material/Edit';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
} from '@mui/material';
import type { VisibilityState } from '@tanstack/react-table';
import { seq } from '@tunarr/shared/util';
import type { RandomSlot } from '@tunarr/types/api';
import dayjs from 'dayjs';
import {
  capitalize,
  filter,
  floor,
  identity,
  isEmpty,
  isNil,
  map,
  maxBy,
  nth,
  round,
  sum,
  uniq,
} from 'lodash-es';
import type {
  MRT_ColumnDef,
  MRT_Row,
  MRT_TableInstance,
} from 'material-react-table';
import {
  MaterialReactTable,
  useMaterialReactTable,
} from 'material-react-table';
import pluralize from 'pluralize';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { usePrevious, useToggle } from 'react-use';
import { P, match } from 'ts-pattern';

export const RandomSlotTable = () => {
  const { slotArray, getValues, watch, setValue } = useRandomSlotFormContext();
  const { dropdownOpts: programOptions, nameById: programOptionNameById } =
    useSlotProgramOptions();

  const slotIds = useMemo(
    () => uniq(map(slotArray.fields, (slot) => getRandomSlotId(slot))),
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

  const [weightAdjustDialogOpen, toggleWeightAdjustDialogOpen] =
    useToggle(false);

  const [currentSlotWarningsIndex, setCurrentSlotWarningsIndex] = useState<
    number | null
  >(null);

  const slotDistribution = getValues('randomDistribution');
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    weight: slotDistribution === 'weighted',
    cooldownMs: slotDistribution !== 'none',
  });

  const [currentSlots, distributionType] = watch([
    'slots',
    'randomDistribution',
  ]);
  const prevDistributionType = usePrevious(distributionType);

  useEffect(() => {
    const sub = watch((value, { name }) => {
      if (name === 'randomDistribution' || name === 'lockWeights') {
        match([value.randomDistribution, value.lockWeights])
          .with([P.string, true], () => {
            const newWeight = round(100 / currentSlots.length, 2);
            setValue(
              'slots',
              map(currentSlots, (slot) => ({ ...slot, weight: newWeight })),
              { shouldDirty: true },
            );
          })
          .with([P.string, false], () => {
            const maxWeight =
              maxBy(currentSlots, (slot) => slot.weight)?.weight ?? 100.0;
            setValue(
              'slots',
              map(currentSlots, (slot) => ({
                ...slot,
                weight: Math.ceil(
                  (UnlockedWeightScale * slot.weight) / maxWeight,
                ),
              })),
              { shouldDirty: true },
            );
          })
          .otherwise(() => {});
      }

      setColumnVisibility((prev) => ({
        ...prev,
        weight: value.randomDistribution === 'weighted',
        cooldownMs: value.randomDistribution !== 'none',
      }));
    });
    return () => sub.unsubscribe();
  }, [currentSlots, prevDistributionType, setValue, watch]);

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
        header: 'Type',
        accessorKey: 'durationSpec.type',
        Cell: ({ cell }) => {
          const value = cell.getValue<string>();
          return capitalize(value);
        },
        size: 100,
        grow: false,
      },
      {
        header: 'Duration',
        id: 'duration',
        accessorFn: (slot) => {
          switch (slot.durationSpec.type) {
            case 'fixed':
              return slot.durationSpec.durationMs;
            case 'dynamic':
              return slot.durationSpec.programCount;
          }
        },
        Cell: ({ cell, row }) => {
          const value = cell.getValue<number>();
          switch (row.original.durationSpec.type) {
            case 'fixed':
              return betterHumanize(dayjs.duration(value), {
                exact: true,
                style: 'full',
              });
            case 'dynamic':
              return `${value} ${pluralize('program', value)}`;
          }
        },
        size: 100,
        grow: false,
      },
      {
        header: 'Program',
        id: 'programming',
        accessorFn: identity,
        enableEditing: true,
        Cell: ({ cell }) => {
          const value = cell.getValue<RandomSlot>();
          return programOptionNameById[getRandomSlotId(value)];
        },
        grow: true,
        size: 350,
      },
      {
        header: 'Order',
        accessorFn(originalRow) {
          switch (originalRow.type) {
            case 'flex':
            case 'redirect':
              return null;
            case 'movie':
            case 'show':
            case 'custom-show':
            case 'filler':
              return originalRow.order.split('_').map(capitalize).join(' ');
          }
        },
        id: 'programOrder',
        Header() {
          return (
            <Tooltip
              placement="top"
              title="Order of programming within the slot"
            >
              <span>Order</span>
            </Tooltip>
          );
        },
        Cell({ cell }) {
          const value = cell.getValue<RandomSlot['order'] | null>();
          if (!value) {
            return '-';
          }
          return value;
        },
        enableSorting: false,
      },
      {
        header: 'Cooldown',
        accessorKey: 'cooldownMs',
        Cell: ({ cell }) => {
          const value = cell.getValue<number>();
          if (value <= 0) {
            return '0s';
          }

          return betterHumanize(dayjs.duration(value), {
            exact: true,
            style: 'full',
          });
        },
        size: 100,
        grow: false,
      },
      {
        header: 'Weight',
        accessorKey: 'weight',
        enableSorting: false,
        Cell: ({ cell }) => `${cell.getValue<number>()}%`,
      },
    ];
  }, [programOptionNameById]);

  const onDeleteSlot = useCallback(
    (index: number) => {
      const removedSlotWeight = currentSlots[index].weight;
      const newLength = currentSlots.length - 1;
      const distributed = removedSlotWeight / newLength;
      setValue(
        'slots',
        seq.collect(currentSlots, (slot, idx) => {
          if (idx === index) {
            return;
          }

          return {
            ...slot,
            weight: floor(slot.weight + distributed, 2),
          };
        }),
      );
    },
    [currentSlots, setValue],
  );

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
          <IconButton onClick={() => onDeleteSlot(row.index)}>
            <Delete />
          </IconButton>
        </Tooltip>
      </>
    );
  };

  const detailsBySlotId = useScheduledSlotProgramDetails(slotIds);

  const rows = useMemo<RandomSlotTableRowType[]>(() => {
    const totalWeight = sum(map(slotArray.fields, 'weight'));
    return map(slotArray.fields, (slot) => {
      const warnings: SlotWarning[] = [];
      const slotId = getRandomSlotId(slot);
      const slotDetails = detailsBySlotId[slotId];
      let programCount = 0;
      if (slotDetails) {
        const durationSpec = slot.durationSpec;
        if (durationSpec.type === 'fixed') {
          const overDuration = filter(
            slotDetails.programDurations,
            ({ duration }) => duration > durationSpec.durationMs,
          );

          if (overDuration.length > 0) {
            warnings.push({
              type: 'program_too_long',
              programs: overDuration,
            });
          }
        }

        programCount = slotDetails.programCount;
      }
      return {
        ...slot,
        weight: round((slot.weight / totalWeight) * 100.0, 2),
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
          {distributionType === 'weighted' && (
            <Button
              onClick={() => toggleWeightAdjustDialogOpen(true)}
              startIcon={<Balance />}
            >
              Adjust Weights
            </Button>
          )}
          <RandomSlotPresetButton />
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
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      pagination,
      columnVisibility,
    },
    enableSorting: distributionType !== 'none',
    enableRowOrdering: distributionType === 'none',
    muiRowDragHandleProps: ({ table }) => ({
      onDragEnd: () => {
        const { draggingRow, hoveredRow } = table.getState();
        if (hoveredRow && draggingRow) {
          slotArray.swap(hoveredRow.index!, draggingRow.index);
        }
      },
    }),
  });

  const stopBubble: React.DragEventHandler = useCallback((e) => {
    e.stopPropagation();
  }, []);

  return (
    <>
      {/* This is necessary to ensure that the any react-dnd driven stuff still works, since they listen to events on the top-level window */}
      <Box
        onDragStart={stopBubble}
        onDragEnter={stopBubble}
        onDragOver={stopBubble}
        onDrop={stopBubble}
      >
        <MaterialReactTable table={table} />
      </Box>
      <Dialog
        maxWidth="md"
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
      <RandomSlotsWeightAdjustDialog
        open={weightAdjustDialogOpen}
        onClose={() => toggleWeightAdjustDialogOpen()}
      />
    </>
  );
};
