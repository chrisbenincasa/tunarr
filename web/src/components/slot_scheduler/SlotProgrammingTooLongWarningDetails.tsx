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
import { map, round, sum, uniqBy, values } from 'lodash-es';
import type { ListChildComponentProps } from 'react-window';
import { FixedSizeList } from 'react-window';
import { getEpisodeShowId } from '../../helpers/programUtil.ts';

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

  let averageLength = dayjs.duration(0);

  switch (slot.type) {
    case 'movie': {
      const durations = seq.collect(values(programLookup), (program) => {
        if (program.type === 'content' && program.program.type === 'movie') {
          return program.duration;
        }
        return;
      });
      if (durations.length === 0) {
        averageLength = dayjs.duration(
          round(sum(durations) / durations.length),
        );
      }
      break;
    }
    case 'show': {
      const showId = slot.showId;
      const durations = seq.collect(values(programLookup), (program) => {
        if (
          program.type === 'content' &&
          program.program.type === 'episode' &&
          getEpisodeShowId(program.program) === showId
        ) {
          return program.duration;
        }
        return;
      });
      if (durations.length > 0) {
        averageLength = dayjs.duration(
          round(sum(durations) / durations.length),
        );
      }
      break;
    }
    case 'custom-show':
    case 'filler':
    case 'flex':
    case 'redirect':
    default:
      break;
  }

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
        <Typography><Trans>Programs Too Long</Trans></Typography>
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
              {plural(slot.programCount, { one: 'program', other: 'programs' })} exceed the length of
              this slot ({betterHumanize(dayjs.duration(slot.durationMs ?? 0))}
              ). Average program length: {averageLength.humanize()}
              </Trans>
              <br />
              <Trans>This could cause the following slot's programs to go unscheduled.
              Possible solutions include:</Trans>
            </p>
            <ul>
              {}
              {slotType === 'time' && (
                <li><Trans>Increasing "Max Lateness" for the schedule.</Trans></li>
              )}
              <li><Trans>Increasing the slot duration.</Trans></li>
              <li><Trans>Removing overrun programs from the channel.</Trans></li>
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
