import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { Box, CssBaseline, ThemeProvider, useColorScheme } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { type ReactNode, useEffect, useMemo } from 'react';
import { messages as enMessages } from '../src/locales/en/messages.po';
import { createTunarrTheme } from '../src/theme.ts';
import type { Density } from '../src/themeTokens.ts';

i18n.loadAndActivate({ locale: 'en', messages: enMessages });

export type Scheme = 'light' | 'dark';

const SchemeSync = ({ scheme }: { scheme: Scheme }) => {
  const { setMode } = useColorScheme();
  useEffect(() => {
    setMode(scheme);
  }, [scheme, setMode]);
  return null;
};

type StoryProvidersProps = {
  density: Density;
  scheme: Scheme;
  children: ReactNode;
};

export const StoryProviders = ({
  density,
  scheme,
  children,
}: StoryProvidersProps) => {
  const theme = useMemo(() => createTunarrTheme(density), [density]);

  return (
    <I18nProvider i18n={i18n}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <ThemeProvider theme={theme} noSsr>
          <SchemeSync scheme={scheme} />
          <CssBaseline />
          <Box sx={{ p: 3 }}>{children}</Box>
        </ThemeProvider>
      </LocalizationProvider>
    </I18nProvider>
  );
};
