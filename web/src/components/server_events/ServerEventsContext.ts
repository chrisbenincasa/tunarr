import type { Tag, TunarrEvent } from '@tunarr/types';
import { tag } from '@tunarr/types';
import { createContext } from 'react';

export type ServerEventListenerKey = Tag<string, 'server_event_key'>;

export type ServerEventListener = (event: TunarrEvent) => void;

export type ServerEventsContext = {
  addListener: (cb: (event: TunarrEvent) => void) => ServerEventListenerKey;
  removeListener: (key: ServerEventListenerKey) => void;
};

export const ServerEventsContext = createContext<ServerEventsContext>({
  addListener: () => tag(''),
  removeListener() {},
});
