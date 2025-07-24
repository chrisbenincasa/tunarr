import { Box, Dialog, DialogTitle, Paper, Stack } from '@mui/material';
import type { TimeSlot } from '@tunarr/types/api';
import dayjs from 'dayjs';
import { map, range, uniq } from 'lodash-es';
import { useMemo, useRef, useState } from 'react';
import { Rnd } from 'react-rnd';
import { getTextContrast } from '../../helpers/colors.ts';
import { OneDayMillis } from '../../helpers/constants.ts';
import { getTimeSlotId } from '../../helpers/slotSchedulerUtil.ts';
import { useRandomTimeSlotBackgroundColor } from '../../hooks/colorHooks.ts';
import { useSlotProgramOptions } from '../../hooks/programming_controls/useSlotProgramOptions.ts';
import { useGetSlotDescription } from '../../hooks/slot_scheduler/useGetSlotDescription.ts';
import { useScheduledSlotProgramDetails } from '../../hooks/slot_scheduler/useScheduledSlotProgramDetails.ts';
import { useDayjs } from '../../hooks/useDayjs.ts';
import { useTimeSlotFormContext } from '../../hooks/useTimeSlotFormContext.ts';
import { EditTimeSlotDialogContent } from './EditTimeSlotDialogContent.tsx';

const DayWidth = 145;
export const DefaultBlockHeight = 48;
const LeftDividerWidth = 8;

export const TimeSlotCalendarView = () => {
  const providedDjs = useDayjs();
  const calRef = useRef<HTMLDivElement | null>(null);
  const form = useTimeSlotFormContext();
  const [blockHeight, setBlockHeight] = useState(DefaultBlockHeight);
  const fmt = Intl.DateTimeFormat(providedDjs().locale(), {
    hour: 'numeric',
    minute: undefined,
  });
  const [calendarState] = useState(dayjs().startOf('day'));
  const [currentEditingSlot, setCurrentEditingSlot] = useState<{
    slot: TimeSlot;
    index: number;
  } | null>(null);
  const { dropdownOpts: programOptions } = useSlotProgramOptions();

  const calHeight = calRef?.current?.getBoundingClientRect().height;
  const randomBackgroundColor = useRandomTimeSlotBackgroundColor();

  const slotIds = useMemo(
    () => uniq(map(form.slotArray.fields, (slot) => getTimeSlotId(slot))),
    [form.slotArray.fields],
  );
  const detailsBySlotId = useScheduledSlotProgramDetails(slotIds);
  const getSlotDescription = useGetSlotDescription();

  const renderSlots = () => {
    const slots = form.getValues('slots');
    return slots.map((slot, idx) => {
      const next = slots[(idx + 1) % slots.length];
      let duration = next.startTime - slot.startTime;
      if (idx === slots.length - 1) {
        duration += OneDayMillis;
      }
      const height = (duration / OneDayMillis) * 100;

      const px = (calHeight ?? 0) * (duration / OneDayMillis);
      const dataRows = Math.floor((px - 8) / 15);

      const backgroundColor = randomBackgroundColor(slot);
      const details = detailsBySlotId[getTimeSlotId(slot)];

      return (
        <Rnd
          disableDragging
          enableResizing={{
            top: true,
            right: true,
            bottom: true,
            left: false,
            topRight: false,
            bottomRight: false,
            bottomLeft: false,
            topLeft: false,
          }}
          size={{
            width: '90%',
            height: `${height}%`,
          }}
          resizeGrid={[50, 50]}
          style={{
            position: 'relative',
            top: `${(slot.startTime / OneDayMillis) * 100}%`,
          }}
        >
          <Paper
            key={+slot.startTime}
            sx={{
              position: 'absolute',
              // top: `${(slot.startTime / OneDayMillis) * 100}%`,
              left: 0,
              backgroundColor: `${backgroundColor.toString()}`,
              borderRadius: '5px',
              zIndex: 100,
              border: 'thin solid',
              borderColor: 'black',
              cursor: 'pointer',
              color: (theme) =>
                getTextContrast(backgroundColor, theme.palette.mode),
              overflow: 'hidden',
              lineHeight: 1,
              p: 0.5,
            }}
            onClick={
              () => setCurrentEditingSlot({ slot, index: idx })
              // program.type === 'content'
              //   ? setOpenProgramDetails(program)
              //   : void 0
            }
            elevation={
              0
              // program.type === 'content' &&
              // openProgramDetails?.id === program.id
              //   ? 10
              //   : 0
            }
          >
            <Box
              component="span"
              sx={{
                fontSize: 'small',
                fontWeight: 'bold',
                textOverflow: 'clip',
                overflowX: 'hidden',
                whiteSpace: 'nowrap',
              }}
            >
              {getSlotDescription(slot)}
            </Box>
            {dataRows > 1 && (
              <>
                <br />
                <Box
                  component="span"
                  sx={{
                    fontSize: 'small',
                    fontWeight: 'bold',
                    textOverflow: 'clip',
                    overflowX: 'hidden',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {fmt.format(calendarState.add(slot.startTime).toDate())} -{' '}
                  {fmt.format(calendarState.add(next.startTime).toDate())}
                </Box>
              </>
            )}
          </Paper>
        </Rnd>
      );
    });
  };

  return (
    <>
      <Stack direction="row">
        <Stack sx={{ width: `${blockHeight}px` }}>
          {range(0, 24).map((hour) => (
            <Box
              sx={{
                height: `${blockHeight}px`,
                lineHeight: 1,
              }}
              key={`side_hour_${hour}`}
            >
              <Box
                component="span"
                sx={{ position: 'relative', top: '-6px', fontSize: '0.9rem' }}
              >
                {hour === 0
                  ? null
                  : fmt.format(calendarState.hour(hour).toDate())}
              </Box>
            </Box>
          ))}
        </Stack>
        <Stack
          sx={{
            '--Grid-borderWidth': '1px',
            borderColor: 'divider',
            overflowY: 'scroll',
            flex: 1,
          }}
          direction="row"
          ref={calRef}
        >
          <Stack sx={{ width: `${LeftDividerWidth}px` }}>
            {range(0, 24).map((idx) => (
              <Box
                key={`divider_small_${idx}`}
                sx={{
                  height: `${blockHeight}px`,
                  '--Grid-borderWidth': '1px',
                  borderTop: 'var(--Grid-borderWidth) solid',
                  borderColor: 'divider',
                }}
              ></Box>
            ))}
          </Stack>

          <Stack
            sx={{
              width: `100%`,
              '--Grid-borderWidth': '1px',
              borderTop: 'var(--Grid-borderWidth) solid',
              borderLeft: 'var(--Grid-borderWidth) solid',
              borderColor: 'divider',
              zIndex: 0,
              position: 'relative',
            }}
          >
            {range(0, 24).map((hour) => (
              <Box
                sx={{
                  height: `${blockHeight}px`,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  position: 'relative',
                }}
                key={`hour_${hour}`}
              ></Box>
            ))}
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
              }}
            >
              {renderSlots()}
              {/* {getProgramsForDay()} */}
            </Box>
          </Stack>
        </Stack>
      </Stack>
      <Dialog
        maxWidth="sm"
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
    </>
  );
};
