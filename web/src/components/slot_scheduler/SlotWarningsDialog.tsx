import { alternateColors } from '@/helpers/util.ts';
import { useProgramTitleFormatter } from '@/hooks/useProgramTitleFormatter.ts';
import { removeChannelProgramsById } from '@/store/entityEditor/util.ts';
import useStore from '@/store/index.ts';
import { Delete, Error, ExpandMore, WarningAmber } from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { seq } from '@tunarr/shared/util';
import dayjs from 'dayjs';
import { map, round, sum, values } from 'lodash-es';
import pluralize from 'pluralize';
import { FixedSizeList, ListChildComponentProps } from 'react-window';
import { ProgramTooLongWarning, SlotTableRowType } from './SlotTypes.ts';

type Props = {
  slot: SlotTableRowType | undefined;
  onClose: () => void;
};

export const SlotWarningsDialog = ({ slot, onClose }: Props) => {
  const programLookup = useStore((s) => s.channelEditor.programLookup);
  const formatter = useProgramTitleFormatter();

  if (!slot) {
    return null;
  }

  const renderProgramTooLongWarning = (warning: ProgramTooLongWarning) => {
    const longPrograms = seq.collect(warning.programs, ({ id }) => {
      return programLookup[id];
    });

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
              alternateColors(props.index, theme.palette.mode, theme),
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

    switch (slot.programming.type) {
      case 'movie': {
        const durations = seq.collect(values(programLookup), (program) => {
          if (program.type === 'content' && program.subtype === 'movie') {
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
        const showId = slot.programming.showId;
        const durations = seq.collect(values(programLookup), (program) => {
          if (
            program.type === 'content' &&
            program.subtype === 'episode' &&
            program.showId === showId
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
          <Typography>Programs Too Long</Typography>
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
                Remove All
              </Button>
            </Stack>
            <div>
              <p>
                {warning.programs.length} of {slot.programCount}{' '}
                {pluralize('program', slot.programCount)} exceed the length of
                this slot ({slot.duration.humanize()}). Average program length:{' '}
                {averageLength.humanize()}
                <br />
                These programs could cause the following slot's programs to go
                unscheduled. Possible solutions include:
              </p>
              <ul>
                <li>Increasing "Max Lateness" for the schedule.</li>
                <li>Increasing the slot duration.</li>
                <li>Removing overrun programs from the channel.</li>
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

  const renderWarnings = () => {
    return map(slot.warnings, (warning) => {
      switch (warning.type) {
        case 'program_too_long':
          return renderProgramTooLongWarning(warning);
      }
    });
  };

  return (
    <Dialog open={!!slot} onClose={() => onClose()} fullWidth maxWidth="md">
      <DialogTitle>Slot Warnings</DialogTitle>
      <DialogContent>{renderWarnings()}</DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()} variant="contained">
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
};
