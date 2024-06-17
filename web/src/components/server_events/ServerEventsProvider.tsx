import { TunarrEventSchema } from '@tunarr/types/schemas';
import { ReactNode, useCallback, useEffect, useRef } from 'react';
import {
  ServerEventListener,
  ServerEventListenerKey,
  ServerEventsContext,
} from './ServerEventsContext';
import { useSettings } from '@/store/settings/selectors';
import { v4 } from 'uuid';
import { tag } from '@tunarr/types';
import { isEqual, omit, some, values } from 'lodash-es';

type Props = {
  children: ReactNode;
};

export function ServerEventsProvider({ children }: Props) {
  const { backendUri } = useSettings();
  const source = useRef<EventSource | null>(null);
  const listeners = useRef<Record<ServerEventListenerKey, ServerEventListener>>(
    {},
  );

  const addListener = useCallback(
    (listener: ServerEventListener) => {
      const key = tag<ServerEventListenerKey>(v4());
      if (!some(values(listeners.current), (l) => isEqual(l, listener))) {
        listeners.current = {
          ...listeners.current,
          [key]: listener,
        };
      }
      return key;
    },
    [listeners],
  );

  const removeListener = useCallback(
    (key: ServerEventListenerKey) => {
      console.log('removing listener key ', key);
      listeners.current = omit(listeners.current, key);
    },
    [listeners],
  );

  useEffect(() => {
    let es: EventSource | undefined;
    if (!source.current) {
      es = new EventSource(`${backendUri}/api/events`);
      source.current = es;

      es.addEventListener('message', (event: MessageEvent<string>) => {
        const parsed = TunarrEventSchema.safeParse(JSON.parse(event.data));
        if (parsed.success) {
          if (parsed.data.type !== 'heartbeat') {
            for (const listener of values(listeners.current)) {
              listener(parsed.data);
            }
          }
        } else {
          console.error(parsed.error);
        }
      });
    }

    return () => {
      source.current = null;
      listeners.current = {};
      es?.close();
    };
  }, [source, backendUri]);

  return (
    <ServerEventsContext.Provider value={{ addListener, removeListener }}>
      {children}
    </ServerEventsContext.Provider>
  );
}
