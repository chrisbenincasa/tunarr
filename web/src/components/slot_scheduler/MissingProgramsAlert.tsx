import type { ProgramOption } from '@/helpers/slotSchedulerUtil';
import { slotOptionIsScheduled } from '@/helpers/slotSchedulerUtil';
import { ExpandLess, ExpandMore } from '@mui/icons-material';
import { Alert, Collapse, IconButton, ListItem } from '@mui/material';
import type { BaseSlot } from '@tunarr/types/api';
import { isEmpty, map, reject } from 'lodash-es';
import pluralize from 'pluralize';
import { useMemo } from 'react';
import { useToggle } from 'usehooks-ts';

type Props = {
  slots: BaseSlot[];
  programOptions: ProgramOption[];
};

export const MissingProgramsAlert = ({
  slots: currentSlots,
  programOptions,
}: Props) => {
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
        There {pluralize('is', unscheduledOptions.length)}{' '}
        {unscheduledOptions.length} unscheduled{' '}
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
