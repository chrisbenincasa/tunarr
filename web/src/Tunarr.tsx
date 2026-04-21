import { setUiLocale } from '@/store/settings/actions.ts';
import { DayjsProvider } from '@/providers/DayjsProvider.tsx';
import useStore from '@/store/index.ts';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { esES as muiEsES } from '@mui/material/locale';
import { esES as pickersEsES } from '@mui/x-date-pickers/locales';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { SnackbarProvider } from 'notistack';
import { useEffect, useMemo } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { ServerEventsProvider } from './components/server_events/ServerEventsProvider.tsx';
import { TunarrApiProvider } from './context/TunarrApiContext.tsx';
import { messages as enMessages } from './locales/en/messages';
import { queryClient } from './queryClient.ts';
import { router } from './router.ts';
import { Theme } from './theme.ts';
// Load English immediately as a synchronous fallback so the first render
// always has text (no blank flash or message IDs).
i18n.loadAndActivate({ locale: 'en', messages: enMessages });

export const Tunarr = () => {
  const locale = useStore((store) => store.settings.ui.i18n.locale);

  // On mount and whenever the stored locale changes, load the catalog and
  // dayjs locale module. setUiLocale handles both; the English catalog is
  // already loaded above so 'en' is effectively idempotent.
  useEffect(() => {
    void setUiLocale(locale);
  }, [locale]);

  const muiLocaleTheme = useMemo(() => {
    if (locale === 'es') {
      return createTheme(Theme, muiEsES, pickersEsES);
    }
    return Theme;
  }, [locale]);

  return (
    <TunarrApiProvider queryClient={queryClient}>
      <I18nProvider i18n={i18n}>
        <DayjsProvider>
          <LocalizationProvider
            dateAdapter={AdapterDayjs}
          >
            <DndProvider backend={HTML5Backend}>
              <ServerEventsProvider>
                <QueryClientProvider client={queryClient}>
                  <SnackbarProvider maxSnack={2} autoHideDuration={5000}>
                    <ThemeProvider theme={muiLocaleTheme} noSsr>
                      <RouterProvider basepath="/web" router={router} />
                    </ThemeProvider>
                  </SnackbarProvider>
                </QueryClientProvider>
              </ServerEventsProvider>
            </DndProvider>
          </LocalizationProvider>
        </DayjsProvider>
      </I18nProvider>
    </TunarrApiProvider>
  );
};
