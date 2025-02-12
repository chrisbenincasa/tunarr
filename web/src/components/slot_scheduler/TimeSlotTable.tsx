import { OneDayMillis } from '@/helpers/constants.ts';
import { getTimeSlotId, OneWeekMillis } from '@/helpers/slotSchedulerUtil.ts';
import { useSlotProgramOptions } from '@/hooks/programming_controls/useSlotProgramOptions';
import { useScheduledSlotProgramDetails } from '@/hooks/slot_scheduler/useScheduledSlotProgramDetails.ts';
import { Delete, Edit, Warning } from '@mui/icons-material';
import {
  Box,
  BoxProps,
  Dialog,
  DialogTitle,
  IconButton,
  Stack,
  styled,
  Tab,
  Tabs,
  Tooltip,
} from '@mui/material';
import { blue, green, orange, pink, purple } from '@mui/material/colors';
import { prettifySnakeCaseString } from '@tunarr/shared/util';
import { type SlotFiller, type TimeSlot } from '@tunarr/types/api';
import dayjs from 'dayjs';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import {
  capitalize,
  filter,
  find,
  identity,
  isEmpty,
  isNil,
  map,
  nth,
  range,
  sortBy,
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
import { useMemo, useState } from 'react';
import { useDayjs } from '../../hooks/useDayjs.ts';
import { useTimeSlotFormContext } from '../../hooks/useTimeSlotFormContext.ts';
import { AddTimeSlotButton } from './AddTimeSlotButton.tsx';
import { ClearSlotsButton } from './ClearSlotsButton.tsx';
import { EditTimeSlotDialogContent } from './EditTimeSlotDialogContent.tsx';
import type { SlotWarning, TimeSlotTableRowType } from './SlotTypes.ts';
import { TimeSlotWarningsDialog } from './TimeSlotWarningsDialog.tsx';

dayjs.extend(localizedFormat);

interface CircleProps extends BoxProps {
  color?: string;
}

const SmallCircle = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'color',
})<CircleProps>(({ color = '#87CEEB' }) => ({
  width: '50px',
  height: '50px',
  borderRadius: '50%',
  backgroundColor: color,
  boxShadow: `0 0 10px ${color}`,
}));

const fillerKindToColor = {
  head: blue['A100'],
  pre: purple['A100'],
  post: green['200'],
  tail: orange['A100'],
  fallback: pink['A100'],
};

export const TimeSlotTable = () => {
  const providedDjs = useDayjs();
  const localeData = useMemo(() => providedDjs().localeData(), [providedDjs]);
  const { watch, slotArray } = useTimeSlotFormContext();
  const [currentPeriod, latenessMs] = watch(['period', 'latenessMs']);
  const { dropdownOpts: programOptions } = useSlotProgramOptions();
  const startOfPeriod = dayjs().startOf(currentPeriod);
  const slotIds = useMemo(
    () => uniq(map(slotArray.fields, (slot) => getTimeSlotId(slot))),
    [slotArray.fields],
  );
  const [selectedDay, setSelectedDay] = useState(0);

  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 25,
  });

  const detailsBySlotId = useScheduledSlotProgramDetails(slotIds);

  const [currentEditingSlot, setCurrentEditingSlot] = useState<{
    slot: TimeSlot;
    index: number;
  } | null>(null);

  const [currentSlotWarningsIndex, setCurrentSlotWarningsIndex] = useState<
    number | null
  >(null);

  const rows = useMemo(() => {
    return map(
      sortBy(
        slotArray.fields
          .map((slot, index) => ({
            ...slot,
            originalIndex: index,
          }))
          .filter((slot) => {
            if (currentPeriod !== 'week') {
              return true;
            }
            const start = OneDayMillis * selectedDay;
            const end = start + OneDayMillis;
            return slot.startTime >= start && slot.startTime < end;
          }),
        (slot) => slot.startTime,
      ),
      (slot, i, slots) => {
        const next = slots[(i + 1) % slots.length];
        const scale =
          i === slots.length - 1
            ? currentPeriod === 'week'
              ? OneWeekMillis
              : OneDayMillis
            : 0;
        const slotDuration = next.startTime + scale - slot.startTime;
        const warnings: SlotWarning[] = [];
        const slotId = getTimeSlotId(slot);
        const slotDetails = detailsBySlotId[slotId];
        let programCount = 0;
        if (slotDetails) {
          const overDuration = filter(
            slotDetails.programDurations,
            ({ duration }) => duration > slotDuration + latenessMs,
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
          durationMs: slotDuration,
          warnings,
          programCount,
        } satisfies TimeSlotTableRowType;
      },
    );
  }, [
    currentPeriod,
    detailsBySlotId,
    latenessMs,
    selectedDay,
    slotArray.fields,
  ]);

  const columns = useMemo<MRT_ColumnDef<TimeSlotTableRowType>[]>(() => {
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
        header: 'Start Time',
        accessorKey: 'startTime',
        Cell: ({ cell }) => {
          const value = cell.getValue<number>();
          const dateTime = startOfPeriod.add(value);
          return currentPeriod === 'day'
            ? dateTime.format('LT')
            : dateTime.format('dddd LT');
        },
        size: 100,
        grow: false,
      },
      {
        header: 'Program',
        // accessorKey: 'programming',
        accessorFn: identity,
        id: 'programming',
        enableEditing: true,
        Cell: ({ cell }) => {
          const value = cell.getValue<TimeSlot>();
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
            case 'custom-show': {
              const showName = find(programOptions, {
                customShowId: value.customShowId,
              })?.description;
              return `Custom Show - ${showName}`;
            }
            case 'filler': {
              const showName = find(programOptions, {
                fillerListId: value.fillerListId,
              })?.description;
              return `Filler - ${showName}`;
            }
          }
        },
        grow: true,
        size: 350,
      },
      {
        header: '# of Programs',
        id: 'programCount',
        enableEditing: false,
        Cell({ row }) {
          const programming = row.original;
          switch (programming.type) {
            case 'movie':
            case 'show':
            case 'custom-show':
            case 'filler':
              return row.original.programCount;
            case 'flex':
            case 'redirect':
              return '-';
          }
        },
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
              return prettifySnakeCaseString(originalRow.order);
          }
        },
        id: 'programOrder',
        Cell({ cell }) {
          const value = cell.getValue<TimeSlot['order'] | null>();
          if (!value) {
            return '-';
          }
          return value;
        },
        enableSorting: false,
      },
      {
        header: 'Filler',
        id: 'filler',
        accessorFn: (row) => {
          switch (row.type) {
            case 'movie':
            case 'show':
            case 'custom-show':
              return row.filler ?? [];
            case 'filler':
            case 'flex':
            case 'redirect':
              return [];
          }
        },
        Cell: ({ cell }) => {
          const filler = cell.getValue<SlotFiller[]>();
          const fillerKinds = uniq(filler.flatMap((f) => f.types));
          if (fillerKinds.length === 0) {
            return '-';
          }

          return (
            <Stack direction="row" spacing={1}>
              {(['head', 'pre', 'post', 'tail', 'fallback'] as const).map(
                (type) => {
                  return (
                    <Tooltip
                      placement="top"
                      title={capitalize(type)}
                      key={type}
                    >
                      <SmallCircle
                        color={fillerKindToColor[type]}
                        sx={{
                          width: '10px',
                          height: '10px',
                          visibility: fillerKinds.includes(type)
                            ? 'visible'
                            : 'hidden',
                        }}
                      />
                    </Tooltip>
                  );
                },
              )}
            </Stack>
          );
        },
      },
    ];
  }, [currentPeriod, programOptions, startOfPeriod]);

  const renderActionCell = ({
    row,
  }: {
    row: MRT_Row<TimeSlotTableRowType>;
    table: MRT_TableInstance<TimeSlotTableRowType>;
  }) => {
    return (
      <>
        <Tooltip title="Edit Slot" placement="top">
          <IconButton
            onClick={() =>
              setCurrentEditingSlot({
                slot: row.original,
                index: row.original.originalIndex,
              })
            }
          >
            <Edit />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete Slot" placement="top">
          <IconButton
            onClick={() => slotArray.remove(row.original.originalIndex)}
          >
            <Delete />
          </IconButton>
        </Tooltip>
      </>
    );
  };

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
          <AddTimeSlotButton
            onAdd={(slot) =>
              setCurrentEditingSlot({ slot, index: slotArray.fields.length })
            }
            programOptions={programOptions}
            dayOffset={selectedDay}
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
      {currentPeriod === 'week' && (
        <Box
          sx={{ width: '100%', borderBottom: 1, borderColor: 'divider', mb: 2 }}
        >
          <Tabs
            value={selectedDay}
            onChange={(_, v) => setSelectedDay(v as number)}
          >
            {range(0, 7).map((idx) => (
              <Tab
                key={idx}
                value={idx}
                label={<span>{localeData.weekdaysShort()[idx]}</span>}
              />
            ))}
          </Tabs>
        </Box>
      )}
      <MaterialReactTable table={table} />
      <Dialog
        maxWidth="md"
        open={!!currentEditingSlot}
        fullWidth
        onClose={() => setCurrentEditingSlot(null)}
      >
        <DialogTitle>Edit Slot</DialogTitle>
        {currentEditingSlot && (
          <EditTimeSlotDialogContent
            slot={currentEditingSlot.slot}
            index={currentEditingSlot.index}
            programOptions={programOptions}
            onClose={() => setCurrentEditingSlot(null)}
          />
        )}
      </Dialog>
      <TimeSlotWarningsDialog
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
