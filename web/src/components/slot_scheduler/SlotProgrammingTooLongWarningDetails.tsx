import { betterHumanize } from '@/helpers/dayjs.ts';
import { alternateColors } from '@/helpers/util.ts';
import { plural } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useProgramTitleFormatter } from '@/hooks/useProgramTitleFormatter.ts';
import type {
  ProgramTooLongWarning,
  SlotTableWarnings,
} from '@/model/CommonSlotModels';
import { removeChannelProgramsById } from '@/store/entityEditor/util.ts';
import { useStoreProgramLookup } from '@/store/selectors.ts';
import { Delete, Error, ExpandMore, WarningAmber } from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  IconButton,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { seq } from '@tunarr/shared/util';
import type { BaseSlot } from '@tunarr/types/api';
import dayjs from 'dayjs';
import { map, uniqBy, values } from 'lodash-es';
import { averageProgramDurationMs } from '@/helpers/slots.ts';
import type { ListChildComponentProps } from 'react-window';
import { FixedSizeList } from 'react-window';

type Props = {
  slot: BaseSlot & SlotTableWarnings;
  slotType: 'time' | 'random';
  warning: ProgramTooLongWarning;
};

export const SlotProgrammingTooLongWarningDetails = ({
  slot,
  warning,
  slotType,
}: Props) => {
  const formatter = useProgramTitleFormatter();
  const programLookup = useStoreProgramLookup();

  const longPrograms = seq.collect(
    uniqBy(warning.programs, (p) => p.id),
    ({ id }) => {
      return programLookup[id];
    },
  );

  const renderLongProgramRow = (props: ListChildComponentProps) => {
    const program = longPrograms[props.index];
    if (!program.id) {
      return null;
    }

    const programId = program.id;

    return (
      <ListItem
        style={props.style}
        sx={{
          backgroundColor: (theme) =>
            alternateColors(props.index, theme.palette.mode),
        }}
        key={programId}
        component="div"
      >
        <ListItemText primary={formatter(program)} />
        <IconButton
          onClick={() => removeChannelProgramsById(programId)}
          edge="end"
          aria-label="delete"
          size="small"
        >
          <Delete fontSize="small" />
        </IconButton>
      </ListItem>
    );
  };

  const averageLengthMs = averageProgramDurationMs(slot, values(programLookup));

  return (
    <Accordion
      defaultExpanded={slot.warnings.length === 1}
      key={warning.type}
      elevation={5}
    >
      <AccordionSummary expandIcon={<ExpandMore />}>
        {warning.programs.length === slot.programCount ? (
          <Error sx={{ mr: 1, color: (theme) => theme.palette.error.main }} />
        ) : (
          <WarningAmber
            sx={{ mr: 1, color: (theme) => theme.palette.warning.main }}
          />
        )}
        <Typography>
          <Trans>Programs Too Long</Trans>
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack>
          <Stack direction="row">
            <Button
              onClick={() =>
                removeChannelProgramsById(
                  new Set(map(warning.programs, (p) => p.id)),
                )
              }
            >
              <Trans>Remove All</Trans>
            </Button>
          </Stack>
          <div>
            <p>
              <Trans>
                {warning.programs.length} of {slot.programCount}{' '}
                {plural(slot.programCount, {
                  one: 'program',
                  other: 'programs',
                })}{' '}
                exceed the length of this slot (
                {betterHumanize(dayjs.duration(slot.durationMs ?? 0))}).
              </Trans>
              {averageLengthMs !== undefined && (
                <>
                  {' '}
                  <Trans>
                    Average program length:{' '}
                    {betterHumanize(dayjs.duration(averageLengthMs))}
                  </Trans>
                </>
              )}
              <br />
              <Trans>
                This could cause the following slot's programs to go
                unscheduled. Possible solutions include:
              </Trans>
            </p>
            <ul>
              {}
              {slotType === 'time' && (
                <li>
                  <Trans>Increasing "Max Lateness" for the schedule.</Trans>
                </li>
              )}
              <li>
                <Trans>Increasing the slot duration.</Trans>
              </li>
              <li>
                <Trans>Removing overrun programs from the channel.</Trans>
              </li>
            </ul>
          </div>
          <Box sx={{ width: '100%', height: 400 }}>
            <FixedSizeList
              height={400}
              width={'100%'}
              itemSize={46}
              itemCount={longPrograms.length}
              overscanCount={5}
            >
              {renderLongProgramRow}
            </FixedSizeList>
          </Box>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
