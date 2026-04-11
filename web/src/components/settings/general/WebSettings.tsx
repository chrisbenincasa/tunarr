import DarkModeButton from '@/components/settings/DarkModeButton.tsx';
import useStore from '@/store/index.ts';
import {
  setTimeFormat,
  setUiLocale,
} from '@/store/settings/actions.ts';
import type { SupportedLocales, TimeFormat } from '@/store/settings/store.ts';
import { Trans, useLingui } from '@lingui/react/macro';
import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useCallback } from 'react';
import type { Nullable } from '../../../types/util.ts';

export const WebSettings = () => {
  const { t } = useLingui();
  const locale = useStore((state) => state.settings.ui.i18n.locale);
  const timeFormat = useStore((state) => state.settings.ui.i18n.timeFormat);

  const handleLocaleChange = useCallback((value: SupportedLocales) => {
    void setUiLocale(value);
  }, []);

  const handleTimeFormatChange = useCallback(
    (value: Nullable<TimeFormat>) => {
      if (value) {
        void setTimeFormat(value);
      }
    },
    [],
  );

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5">
          <Trans>Web Settings</Trans>
        </Typography>
        <Typography variant="subtitle2">
          <Trans>
            These settings are stored in your browser and are saved
            automatically when changed.
          </Trans>
        </Typography>
      </Box>

      <Box>
        <Typography variant="h6" sx={{ mb: 2 }}>
          <Trans>Language</Trans>
        </Typography>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="language-select-label">
            <Trans>Language</Trans>
          </InputLabel>
          <Select
            labelId="language-select-label"
            value={locale}
            label={t`Language`}
            onChange={(e) =>
              handleLocaleChange(e.target.value as SupportedLocales)
            }
          >
            <MenuItem value="en">English</MenuItem>
            <MenuItem value="es">Español</MenuItem>
            {import.meta.env.DEV && (
              <MenuItem value="pseudo-LOCALE">pseudo-LOCALE (dev)</MenuItem>
            )}
          </Select>
        </FormControl>
      </Box>

      <Box>
        <Typography variant="h6" sx={{ mb: 2 }}>
          <Trans>Time Format</Trans>
        </Typography>
        <ToggleButtonGroup
          value={timeFormat}
          exclusive
          onChange={(_, value) =>
            handleTimeFormatChange(value as Nullable<TimeFormat>)
          }
          aria-label={t`Time format`}
        >
          <ToggleButton value="12h">
            <Trans>12-hour</Trans>
          </ToggleButton>
          <ToggleButton value="24h">
            <Trans>24-hour</Trans>
          </ToggleButton>
          <ToggleButton value="auto">
            <Trans>Auto</Trans>
          </ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="caption" display="block" sx={{ mt: 1 }}>
          <Trans>
            Auto uses the time convention for the selected language.
          </Trans>
        </Typography>
      </Box>

      <Box>
        <Typography variant="h6" sx={{ mb: 2 }}>
          <Trans>Theme Settings</Trans>
        </Typography>
        <DarkModeButton />
      </Box>
    </Stack>
  );
};
