import DarkModeButton from '@/components/settings/DarkModeButton.tsx';
import useStore from '@/store/index.ts';
import { setUiLocale } from '@/store/settings/actions.ts';
import type { SupportedLocales } from '@/store/settings/store.ts';
import {
  Box,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useCallback } from 'react';
import type { Nullable } from '../../../types/util.ts';

export const WebSettings = () => {
  const locale = useStore((state) => state.settings.ui.i18n.locale);

  const handleUiLocaleChange = useCallback(
    (value: Nullable<SupportedLocales>) => {
      if (value) {
        setUiLocale(value);
      }
    },
    [],
  );

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5">Web Settings</Typography>
        <Typography variant="subtitle2">
          These settings are stored in your browser and are saved automatically
          when changed.
        </Typography>
      </Box>

      <Box>
        <ToggleButtonGroup
          value={locale}
          exclusive
          onChange={(_, value) =>
            handleUiLocaleChange(value as Nullable<SupportedLocales>)
          }
          aria-label="text alignment"
        >
          <ToggleButton value="en" aria-label="left aligned">
            12-hour
          </ToggleButton>
          <ToggleButton value="en-gb" aria-label="centered">
            24-hour
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Box>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Theme Settings
        </Typography>
        <DarkModeButton />
      </Box>
    </Stack>
  );
};
