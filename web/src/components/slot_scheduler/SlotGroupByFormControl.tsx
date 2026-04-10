import {
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
} from '@mui/material';
import type { SlotGroupBy } from '@tunarr/types/api';
import { Controller, useFormContext } from 'react-hook-form';

type SlotWithGroupBy = {
  groupBy?: SlotGroupBy;
};

export const SlotGroupByFormControl = () => {
  const { control, watch, setValue } = useFormContext<SlotWithGroupBy>();
  const groupBy = watch('groupBy');
  const isEnabled = !!groupBy;

  const handleToggle = (checked: boolean) => {
    if (checked) {
      setValue('groupBy', {
        type: 'tag',
        ungrouped: 'include',
        multiTagBehavior: 'first',
      });
    } else {
      setValue('groupBy', undefined);
    }
  };

  return (
    <Stack spacing={2}>
      <FormControlLabel
        control={
          <Switch
            checked={isEnabled}
            onChange={(_, checked) => handleToggle(checked)}
          />
        }
        label="Group by Tag"
      />
      {isEnabled && (
        <>
          <FormHelperText>
            Group programs by shared tags for marathon-style playback. Programs
            within each group play in chronological order.
          </FormHelperText>
          <Controller
            control={control}
            name="groupBy.ungrouped"
            render={({ field }) => (
              <FormControl fullWidth size="small">
                <InputLabel>Untagged Programs</InputLabel>
                <Select label="Untagged Programs" {...field}>
                  <MenuItem value="include">
                    Include as individual items
                  </MenuItem>
                  <MenuItem value="exclude">Exclude</MenuItem>
                </Select>
              </FormControl>
            )}
          />
          <Controller
            control={control}
            name="groupBy.multiTagBehavior"
            render={({ field }) => (
              <FormControl fullWidth size="small">
                <InputLabel>Multi-tag Behavior</InputLabel>
                <Select label="Multi-tag Behavior" {...field}>
                  <MenuItem value="first">First matching tag</MenuItem>
                  <MenuItem value="all">All matching groups</MenuItem>
                </Select>
              </FormControl>
            )}
          />
        </>
      )}
    </Stack>
  );
};
