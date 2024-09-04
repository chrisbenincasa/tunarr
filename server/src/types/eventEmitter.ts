export type TypedEventEmitter<Events extends EventMap> = {
  addListener<E extends keyof Events>(
    event: E,
    listener: Events[E],
  ): TypedEventEmitter<Events>;
  on<E extends keyof Events>(
    event: E,
    listener: Events[E],
  ): TypedEventEmitter<Events>;
  once<E extends keyof Events>(
    event: E,
    listener: Events[E],
  ): TypedEventEmitter<Events>;
  prependListener<E extends keyof Events>(
    event: E,
    listener: Events[E],
  ): TypedEventEmitter<Events>;
  prependOnceListener<E extends keyof Events>(
    event: E,
    listener: Events[E],
  ): TypedEventEmitter<Events>;

  off<E extends keyof Events>(
    event: E,
    listener: Events[E],
  ): TypedEventEmitter<Events>;
  removeAllListeners<E extends keyof Events>(
    event?: E,
  ): TypedEventEmitter<Events>;
  removeListener<E extends keyof Events>(
    event: E,
    listener: Events[E],
  ): TypedEventEmitter<Events>;

  emit<E extends keyof Events>(
    event: E,
    ...args: Parameters<Events[E]>
  ): boolean;
  // The sloppy `eventNames()` return type is to mitigate type incompatibilities - see #5
  eventNames(): (keyof Events | string | symbol)[];
  rawListeners<E extends keyof Events>(event: E): Events[E][];
  listeners<E extends keyof Events>(event: E): Events[E][];
  listenerCount<E extends keyof Events>(event: E): number;

  getMaxListeners(): number;
  setMaxListeners(maxListeners: number): TypedEventEmitter<Events>;
};

export type EventMap = {
  [key: string]: (...args: unknown[]) => void;
};
