import { slotOptionIsScheduled } from '@/helpers/slotSchedulerUtil';
import { useSlotProgramOptions } from '@/hooks/programming_controls/useSlotProgramOptions';
import { TimeSlotForm } from '@/pages/channels/TimeSlotEditorPage';
import { ExpandLess, ExpandMore } from '@mui/icons-material';
import { Alert, Collapse, IconButton, ListItem } from '@mui/material';
import { isEmpty, map, reject } from 'lodash-es';
import pluralize from 'pluralize';
import { useMemo } from 'react';
import { Control, useWatch } from 'react-hook-form';
import { useToggle } from 'usehooks-ts';

type Props = {
  control: Control<TimeSlotForm>;
};

export const MissingProgramsAlert = ({ control }: Props) => {
  const programOptions = useSlotProgramOptions();
  const currentSlots = useWatch({ control, name: 'slots' });
  const [unscheduledOpen, toggleUnscheduledOpen] = useToggle(false);

  const unscheduledOptions = useMemo(
    () =>
      reject(programOptions, (item) =>
        slotOptionIsScheduled(currentSlots, item),
      ),
    [currentSlots, programOptions],
  );

  return (
    !isEmpty(unscheduledOptions) && (
      <Alert
        severity="warning"
        action={
          <IconButton
            aria-label="close"
            color="inherit"
            size="small"
            onClick={() => {
              toggleUnscheduledOpen();
            }}
          >
            {!unscheduledOpen ? (
              <ExpandMore fontSize="inherit" />
            ) : (
              <ExpandLess fontSize="inherit" />
            )}
          </IconButton>
        }
      >
        There are {unscheduledOptions.length} unscheduled{' '}
        {pluralize('program', unscheduledOptions.length)}. Unscheduled items
        will be removed from the channel when saving.
        <Collapse in={unscheduledOpen}>
          <>
            {map(unscheduledOptions, (option) => (
              <ListItem key={option.value}>
                {option.description} ({option.type})
              </ListItem>
            ))}
          </>
        </Collapse>
      </Alert>
    )
  );
};
