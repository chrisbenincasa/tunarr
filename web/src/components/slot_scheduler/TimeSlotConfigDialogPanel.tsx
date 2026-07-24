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
import {
  dropdownValueToOverflow,
  latenessOptions,
  overflowOptions,
  overflowToDropdownValue,
  padOptions,
} from '../../helpers/slotSchedulerUtil.ts';
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
      <FormControl fullWidth margin="normal">
        <InputLabel>{t`Max Overflow`}</InputLabel>
        <Controller
          control={control}
          name="overflow"
          render={({ field }) => (
            <Select
              label={t`Max Overflow`}
              value={
                field.value !== undefined
                  ? overflowToDropdownValue(field.value)
                  : ''
              }
              onChange={(e) => {
                const val = e.target.value;
                field.onChange(
                  val === '' ? undefined : dropdownValueToOverflow(val),
                );
              }}
            >
              <MenuItem value="">{t`Use schedule default`}</MenuItem>
              {overflowOptions.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.description}
                </MenuItem>
              ))}
            </Select>
          )}
        />
        <FormHelperText>
          <Trans>
            Override how far past its boundary this slot's content can extend.
          </Trans>
        </FormHelperText>
      </FormControl>
      <FormControl fullWidth margin="normal">
        <InputLabel>{t`Max Lateness`}</InputLabel>
        <Controller
          control={control}
          name="latenessMs"
          render={({ field }) => (
            <Select
              label={t`Max Lateness`}
              value={field.value ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                field.onChange(val === '' ? undefined : Number(val));
              }}
            >
              <MenuItem value="">{t`Use schedule default`}</MenuItem>
              {latenessOptions.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.description}
                </MenuItem>
              ))}
            </Select>
          )}
        />
        <FormHelperText>
          <Trans>
            Override how late this slot can start if a previous slot ran long.
          </Trans>
        </FormHelperText>
      </FormControl>
    </Stack>
  );
};
