import { OneDayMillis } from '@/helpers/constants.ts';
import { TimeSlotId } from '@/helpers/slotSchedulerUtil.ts';
import { isNonEmptyString } from '@/helpers/util.ts';
import { useSlotProgramOptions } from '@/hooks/programming_controls/useSlotProgramOptions';
import { useChannelEditorLazy } from '@/store/selectors.ts';
import {
  UICondensedChannelProgram,
  UICondensedContentProgram,
  UICondensedCustomProgram,
} from '@/types/index.ts';
import { Maybe } from '@/types/util.ts';
import { Delete, Edit, Warning } from '@mui/icons-material';
import { Dialog, DialogTitle, IconButton, Stack, Tooltip } from '@mui/material';
import { seq } from '@tunarr/shared/util';
import { CondensedChannelProgram, ContentProgram } from '@tunarr/types';
import { TimeSlot, TimeSlotProgramming } from '@tunarr/types/api';
import dayjs from 'dayjs';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import {
  capitalize,
  filter,
  find,
  forEach,
  isEmpty,
  isNil,
  map,
  nth,
  sortBy,
  uniq,
  uniqBy,
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
import { P, match } from 'ts-pattern';
import { useTimeSlotFormContext } from '../../hooks/useTimeSlotFormContext.ts';
import { AddTimeSlotButton } from './AddTimeSlotButton.tsx';
import { ClearSlotsButton } from './ClearSlotsButton.tsx';
import { EditSlotDialogContent } from './EditSlotDialogContent.tsx';
import { SlotTableRowType, SlotWarning } from './SlotTypes.ts';
import { SlotWarningsDialog } from './SlotWarningsDialog.tsx';

dayjs.extend(localizedFormat);

const getSlotId = (programming: TimeSlotProgramming): TimeSlotId => {
  switch (programming.type) {
    case 'show': {
      return `show.${programming.showId}`;
    }
    case 'redirect': {
      return `redirect.${programming.channelId}`;
    }
    case 'custom-show': {
      return `${programming.type}.${programming.customShowId}`;
    }
    default: {
      return programming.type;
    }
  }
};

const getSlotIdForProgram = (
  program: CondensedChannelProgram,
  lookup: Record<string, ContentProgram>,
): Maybe<TimeSlotId> => {
  switch (program.type) {
    case 'content': {
      if (isNonEmptyString(program.id)) {
        const materialized = lookup[program.id];
        if (materialized) {
          switch (materialized.subtype) {
            case 'movie':
              return 'movie';
            case 'episode':
              return isNonEmptyString(materialized.showId)
                ? `show.${materialized.showId}`
                : undefined;
            case 'track':
              return;
          }
        }
      }
      return;
    }
    case 'custom':
      return `custom-show.${program.customShowId}`;
    case 'redirect':
      return `redirect.${program.channel}`;
    case 'flex':
      return 'flex';
  }
};

type SlotProgrammingDetails = {
  programCount: number;
  programDurations: {
    id: string;
    duration: number;
  }[];
};

export const TimeSlotTable = () => {
  const { watch, slotArray } = useTimeSlotFormContext();
  const [currentPeriod, latenessMs] = watch(['period', 'latenessMs']);
  const programOptions = useSlotProgramOptions();
  const startOfPeriod = dayjs().startOf(currentPeriod);
  console.log(startOfPeriod.format());
  const {
    channelEditor: { programLookup, originalProgramList },
  } = useChannelEditorLazy();

  const slotIds = useMemo(
    () => uniq(map(slotArray.fields, (slot) => getSlotId(slot.programming))),
    [slotArray.fields],
  );

  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 25,
  });

  const detailsBySlotId = useMemo(() => {
    const programsBySlot: Map<TimeSlotId, UICondensedChannelProgram[]> =
      new Map();

    forEach(originalProgramList, (program) => {
      if (program.type === 'flex') {
        return;
      }

      const slotId = getSlotIdForProgram(program, programLookup);
      if (!slotId) {
        return;
      }

      if (programsBySlot.has(slotId)) {
        programsBySlot.get(slotId)?.push(program);
      } else {
        programsBySlot.set(slotId, [program]);
      }
    });

    const details: Record<TimeSlotId, SlotProgrammingDetails> = {
      movie: {
        programCount: 0,
        programDurations: [],
      },
      flex: {
        programCount: 0,
        programDurations: [],
      },
    };

    for (const scheduledSlotId of slotIds) {
      if (!programsBySlot.has(scheduledSlotId) || details[scheduledSlotId]) {
        continue;
      }
      const programs = programsBySlot.get(scheduledSlotId)!;
      const programCount = match(scheduledSlotId)
        .with(
          P.string.startsWith('show'),
          P.string.startsWith('custom'),
          P.string.startsWith('movie'),
          () =>
            uniqBy(
              programs as (
                | UICondensedContentProgram
                | UICondensedCustomProgram
              )[],
              (p) => p.id ?? '',
            ).length,
        )
        .otherwise(() => 0);
      const programDurations = match(scheduledSlotId)
        .with(
          P.string.startsWith('show'),
          P.string.startsWith('custom'),
          P.string.startsWith('movie'),
          () =>
            seq.collect(programs, (p) =>
              p.type === 'content' ||
              (p.type === 'custom' && isNonEmptyString(p.id))
                ? { id: p.id!, duration: p.duration }
                : null,
            ),
        )
        .otherwise(() => []);

      details[scheduledSlotId] = {
        programCount,
        programDurations,
      };
    }
    return details;
  }, [originalProgramList, programLookup, slotIds]);

  const [currentEditingSlot, setCurrentEditingSlot] = useState<{
    slot: TimeSlot;
    index: number;
  } | null>(null);

  const [currentSlotWarningsIndex, setCurrentSlotWarningsIndex] = useState<
    number | null
  >(null);

  const rows = useMemo(() => {
    return map(
      sortBy(slotArray.fields, (slot) => slot.startTime),
      (slot, i, slots) => {
        const next = slots[(i + 1) % slots.length];
        const scale = i === slots.length - 1 ? OneDayMillis : 0;
        const slotDuration = dayjs.duration(
          next.startTime + scale - slot.startTime,
        );
        const warnings: SlotWarning[] = [];
        const slotId = getSlotId(slot.programming);
        const slotDetails = detailsBySlotId[slotId];
        let programCount = 0;
        if (slotDetails) {
          const overDuration = filter(
            slotDetails.programDurations,
            ({ duration }) =>
              duration > slotDuration.asMilliseconds() + latenessMs,
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
          duration: slotDuration,
          warnings,
          programCount,
        } satisfies SlotTableRowType;
      },
    );
  }, [detailsBySlotId, latenessMs, slotArray.fields]);

  const columns = useMemo<MRT_ColumnDef<SlotTableRowType>[]>(() => {
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
          console.log(dateTime.format(), value);
          return currentPeriod === 'day'
            ? dateTime.format('hh:mm A')
            : dateTime.format('dddd hh:mm A');
        },
        size: 100,
        grow: false,
      },
      {
        header: 'Program',
        accessorKey: 'programming',
        enableEditing: true,
        Cell: ({ cell }) => {
          const value = cell.getValue<TimeSlotProgramming>();
          switch (value.type) {
            case 'movie':
              return 'Movie';
            case 'show':
              return find(programOptions, { showId: value.showId })
                ?.description;
            case 'flex':
              return 'Flex';
            case 'redirect':
              return 'Redirect';
            case 'custom-show':
              return find(programOptions, { customShowId: value.customShowId })
                ?.description;
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
          const programming = row.original.programming;
          switch (programming.type) {
            case 'movie':
            case 'show':
            case 'custom-show':
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
          const value = cell.getValue<TimeSlot['order'] | null>();
          if (!value) {
            return '-';
          }
          return value;
        },
        enableSorting: false,
      },
    ];
  }, [currentPeriod, programOptions, startOfPeriod]);

  const renderActionCell = ({
    row,
  }: {
    row: MRT_Row<SlotTableRowType>;
    table: MRT_TableInstance<SlotTableRowType>;
  }) => {
    // const {original: slot} = row;
    return (
      <>
        {/* {renderChannelMenu(channel)}
        {!mediumViewport && (
        )} */}
        <Tooltip title="Edit Slot" placement="top">
          <IconButton
            onClick={() =>
              setCurrentEditingSlot({ slot: row.original, index: row.index })
            }
            // to={`/channels/${channel.id}/edit`}
            // component={RouterLink}
            // onClick={(e) => e.stopPropagation()}
          >
            <Edit />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete Slot" placement="top">
          <IconButton
            onClick={() => slotArray.remove(row.index)}
            // to={`/channels/${channel.id}/edit`}
            // component={RouterLink}
            // onClick={(e) => e.stopPropagation()}
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
          />
          <ClearSlotsButton
            fields={slotArray.fields}
            remove={slotArray.remove}
          />
        </Stack>
      );
    },
    muiTableBodyRowProps: () => ({
      sx: {
        // backgroundColor: (theme) => theme.palette.warning.main,
        // color: (theme) => theme.palette.warning.contrastText,
      },
    }),
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
          <EditSlotDialogContent
            slot={currentEditingSlot.slot}
            index={currentEditingSlot.index}
            programOptions={programOptions}
            onClose={() => setCurrentEditingSlot(null)}
          />
        )}
      </Dialog>
      <SlotWarningsDialog
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
