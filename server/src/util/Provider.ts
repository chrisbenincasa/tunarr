export interface Provider<T> {
  get(): T;
}

export function makeProvider<T>(f: () => T): Provider<T> {
  return {
    get: f,
  };
}
