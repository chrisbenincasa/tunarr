import { Chip, Stack } from '@mui/material';
import { capitalize } from 'lodash-es';
import { iterationGroupColor } from '../../helpers/slots.ts';
import { useSlotName } from '../../hooks/slot_scheduler/useSlotName.ts';
import { useTimeSlotFormContext } from '../../hooks/slot_scheduler/useTimeSlotFormContext.ts';
import { slotIsLinkable } from '../../model/CommonSlotModels.ts';
import type { TimeSlotViewModel } from '../../model/TimeSlotModels.ts';

type Props = {
  model: TimeSlotViewModel;
};

export const TimeSlotTableProgramCell = ({ model }: Props) => {
  const { slotArray } = useTimeSlotFormContext();
  const getSlotName = useSlotName();
  const linkDetails = slotIsLinkable(model) ? model : undefined;

  const groupSlotCount = linkDetails?.iterationGroup
    ? slotArray.fields.filter(
        (s) =>
          slotIsLinkable(s) && s.iterationGroup === linkDetails?.iterationGroup,
      ).length
    : 0;

  console.log(slotArray.fields);

  return (
    <Stack direction="row" alignItems="center" gap={0.5}>
      {getSlotName(model) ?? '-'}
      {linkDetails?.iterationGroup && (
        <Chip
          label={`${capitalize(linkDetails.linkMode ?? 'continue')} (${groupSlotCount})`}
          size="small"
          sx={{
            backgroundColor: iterationGroupColor(linkDetails.iterationGroup),
            color: '#fff',
            fontSize: '0.7rem',
            height: 20,
          }}
        />
      )}
    </Stack>
  );
};
