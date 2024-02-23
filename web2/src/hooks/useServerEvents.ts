import { TunarrEvent } from '@tunarr/types';
import { TunarrEventSchema } from '@tunarr/types/schemas';
import { each, once, remove } from 'lodash-es';
import { useCallback, useEffect, useState } from 'react';

type Callback = (event: TunarrEvent) => void;

const observers: Callback[] = [];

let es: EventSource | null;

// Don't really use this yet -- it doesn't play well with HMR
const initEventSource = once(() => {
  if (es) {
    return;
  }

  es = new EventSource('http://localhost:8000/api/events');

  es.addEventListener('message', (event: MessageEvent<string>) => {
    const parsed = TunarrEventSchema.safeParse(JSON.parse(event.data));
    if (parsed.success) {
      console.log('again');
      each(observers, (o) => o(parsed.data));
      // if (parsed.data.type !== 'heartbeat') {

      // }
    } else {
      console.error(parsed.error);
    }
  });
});

export const useServerEvents = (callback: Callback) => {
  initEventSource();
  const [cb, setCb] = useState(() => callback);

  useEffect(() => {
    observers.push(cb);
    return () => {
      remove(observers, (o) => o === cb);
      if (observers.length === 0) {
        es = null;
      }
    };
  }, [cb]);

  const resetCb = useCallback(
    (newCb: Callback) => {
      if (cb == newCb) {
        return;
      }
      remove(observers, (o) => o === cb);
      setCb(() => newCb);
    },
    [cb, setCb],
  );

  return [cb, resetCb];
};
