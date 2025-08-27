import {
  FormControl,
  FormControlLabel,
  FormHelperText,
  Stack,
} from '@mui/material';
import type { TranscodeConfig } from '@tunarr/types';
import { useFormContext } from 'react-hook-form';
import { CheckboxFormController } from '../../util/TypedController.tsx';

export const TranscodeConfigAdvancedOptions = () => {
  const { control } = useFormContext<TranscodeConfig>();
  return (
    <Stack gap={2}>
      <FormControl fullWidth>
        <FormControlLabel
          control={
            <CheckboxFormController
              control={control}
              name="disableHardwareDecoder"
            />
          }
          label={'Disable Hardware Decoding'}
        />
        <FormHelperText>
          Will force use of a software decoder despite hardware acceleration
          settings.
        </FormHelperText>
      </FormControl>
      <FormControl fullWidth>
        <FormControlLabel
          control={
            <CheckboxFormController
              control={control}
              name="disableHardwareEncoding"
            />
          }
          label={'Disable Hardware Encoding'}
        />
        <FormHelperText>
          Will force use of a software encoder despite hardware acceleration
          settings.
        </FormHelperText>
      </FormControl>
      <FormControl fullWidth>
        <FormControlLabel
          control={
            <CheckboxFormController
              control={control}
              name="disableHardwareFilters"
            />
          }
          label={'Disable Hardware Filters'}
        />
        <FormHelperText>
          Will force use of a software filters (e.g. scale, pad, etc.) despite
          hardware acceleration settings.
        </FormHelperText>
      </FormControl>
    </Stack>
  );
};
