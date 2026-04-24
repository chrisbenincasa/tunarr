import { Trans, useLingui } from '@lingui/react/macro';
import {
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Stack,
} from '@mui/material';
import { Controller, useFormContext } from 'react-hook-form';
import { padOptions } from '../../helpers/slotSchedulerUtil.ts';
import type { TimeSlotViewModel } from '../../model/TimeSlotModels.ts';

export const TimeSlotConfigDialogPanel = () => {
  const { t } = useLingui();
  const { control } = useFormContext<TimeSlotViewModel>();
  return (
    <Stack>
      <FormControl fullWidth margin="normal">
        <InputLabel>{t`Pad Times`}</InputLabel>
        <Controller
          control={control}
          name="padMs"
          render={({ field }) => (
            <Select label={t`Pad Times`} {...field}>
              {padOptions.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.description}
                </MenuItem>
              ))}
            </Select>
          )}
        />

        <FormHelperText>
          <Trans>Override how programs within this slot are padded.</Trans>
        </FormHelperText>
      </FormControl>
    </Stack>
  );
};
