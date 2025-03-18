import { ServerEventsContext } from '@/components/server_events/ServerEventsContext';
import { useSnackbar } from 'notistack';
import { useContext, useEffect } from 'react';

export function useServerEvents() {
  return useContext(ServerEventsContext);
}

export function useServerEventsSnackbar() {
  const { addListener, removeListener } = useServerEvents();
  const snackbar = useSnackbar();

  useEffect(() => {
    const key = addListener((ev) => {
      if (ev.message) {
        snackbar.enqueueSnackbar(ev.message, {
          variant: ev.level,
        });
      }
    });

    return () => removeListener(key);
  }, [addListener, removeListener, snackbar]);
}
