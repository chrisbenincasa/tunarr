import { useLingui } from '@lingui/react/macro';
import { Stack } from '@mui/material';
import { useTypedAppFormContext } from '../../../hooks/form.ts';
import type { BaseTranscodeConfigProps } from './BaseTranscodeConfigProps.ts';
import { useBaseTranscodeConfigFormOptions } from './useTranscodeConfigFormOptions.ts';

export const TranscodeConfigAdvancedOptions = ({
  initialConfig,
}: BaseTranscodeConfigProps) => {
  const { t } = useLingui();
  const formOpts = useBaseTranscodeConfigFormOptions(initialConfig);
  const form = useTypedAppFormContext({ ...formOpts });

  return (
    <Stack gap={2}>
      <form.AppField
        name="disableHardwareDecoder"
        children={(field) => (
          <field.BasicCheckboxInput
            label={t`Disable Hardware Decoding`}
            formControlProps={{ fullWidth: true }}
            helperText={t`Will force use of a software decoder despite hardware acceleration settings.`}
          />
        )}
      />

      <form.AppField
        name="disableHardwareEncoding"
        children={(field) => (
          <field.BasicCheckboxInput
            label={t`Disable Hardware Encoding`}
            formControlProps={{ fullWidth: true }}
            helperText={t`Will force use of a software encoder despite hardware acceleration settings.`}
          />
        )}
      />

      <form.AppField
        name="disableHardwareFilters"
        children={(field) => (
          <field.BasicCheckboxInput
            label={t`Disable Hardware Filters`}
            formControlProps={{ fullWidth: true }}
            helperText={t`Will force use of a software filters (e.g. scale, pad, etc.) despite hardware acceleration settings.`}
          />
        )}
      />
    </Stack>
  );
};
