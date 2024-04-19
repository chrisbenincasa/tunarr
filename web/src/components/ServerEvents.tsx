import { Alert, Snackbar } from '@mui/material';
import { TunarrEvent } from '@tunarr/types';
import { TunarrEventSchema } from '@tunarr/types/schemas';
import { first } from 'lodash-es';
import { useEffect, useRef, useState } from 'react';
import { useSettings } from '../store/settings/selectors.ts';

export default function ServerEvents() {
  const { backendUri } = useSettings();
  const source = useRef<EventSource | null>(null);
  const [open, setOpen] = useState(false);
  const [eventQueue, setEventQueue] = useState<readonly TunarrEvent[]>([]);
  const [currentMessage, setCurrentMessage] = useState<TunarrEvent | null>(
    null,
  );

  // const handleEvent = useCallback(
  //   (event: TunarrEvent) => {
  //     if (event.type !== 'heartbeat') {
  //       console.log('test');
  //       setEventQueue((prev) => [...prev, event]);
  //     }
  //   },
  //   [setEventQueue],
  // );

  // useServerEvents(handleEvent);

  useEffect(() => {
    let es: EventSource | undefined;
    if (!source.current) {
      es = new EventSource(`${backendUri}/api/events`);
      source.current = es;

      es.addEventListener('message', (event: MessageEvent<string>) => {
        const parsed = TunarrEventSchema.safeParse(JSON.parse(event.data));
        if (parsed.success) {
          if (parsed.data.type !== 'heartbeat') {
            setEventQueue((prev) => [...prev, parsed.data]);
          }
        } else {
          console.error(parsed.error);
        }
      });
    }

    return () => {
      source.current = null;
      es?.close();
    };
  }, [source, setEventQueue]);

  useEffect(() => {
    if (eventQueue.length > 0 && !currentMessage) {
      setCurrentMessage({ ...first(eventQueue)! });
      setEventQueue((prev) => [...prev.slice(1)]);
      setOpen(true);
    }
  }, [eventQueue, currentMessage, open]);

  const handleClose = () => {
    setOpen(false);
  };

  const handleExited = () => {
    setCurrentMessage(null);
  };

  return (
    <Snackbar
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      autoHideDuration={5000}
      resumeHideDuration={50}
      open={open}
      onClose={handleClose}
      TransitionProps={{ onExited: handleExited }}
    >
      <Alert variant="filled" severity={currentMessage?.level}>
        {currentMessage?.message}
      </Alert>
    </Snackbar>
  );
}
