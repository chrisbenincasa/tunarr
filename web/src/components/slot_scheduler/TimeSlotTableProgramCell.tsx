import { Chip, Stack } from '@mui/material';
import { capitalize } from 'lodash-es';
import { match, P } from 'ts-pattern';
import { iterationGroupColor } from '../../helpers/slots.ts';
import { useSlotName } from '../../hooks/slot_scheduler/useSlotName.ts';
import { useTimeSlotFormContext } from '../../hooks/slot_scheduler/useTimeSlotFormContext.ts';
import type { LinkableSlot } from '../../model/CommonSlotModels.ts';
import { slotIsLinkable } from '../../model/CommonSlotModels.ts';
import type { TimeSlotViewModel } from '../../model/TimeSlotModels.ts';
import type { Maybe } from '../../types/util.ts';

type Props = {
  model: TimeSlotViewModel;
};

export const TimeSlotTableProgramCell = ({ model }: Props) => {
  const { slotArray } = useTimeSlotFormContext();
  const getSlotName = useSlotName();
  const linkDetails = match(model)
    .returnType<Maybe<LinkableSlot>>()
    .with(P.when(slotIsLinkable), (slot) => slot)
    .otherwise(() => undefined);

  const groupSlotCount = linkDetails?.iterationGroup
    ? slotArray.fields.filter(
        (s) =>
          slotIsLinkable(s) && s.iterationGroup === linkDetails?.iterationGroup,
      ).length
    : 0;
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
