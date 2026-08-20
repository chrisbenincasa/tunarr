import type { EventEmitter } from 'node:events';

/**
 * Waits for a specific event to fire, or rejects if the timeout is reached.
 * @template T The expected type array of the event payload data.
 */
export function waitForEvent<Emitter extends EventEmitter, T>(
  emitter: Emitter,
  eventName: string,
  timeoutMs: number,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer: NodeJS.Timeout = setTimeout(() => {
      emitter.off(eventName, eventHandler);
      reject(new Error(`Event '${eventName}' timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    const eventHandler = (...args: unknown[]) => {
      clearTimeout(timer);
      resolve(args as T); // Cast the spread array to our generic type tuple
    };

    emitter.once(eventName, eventHandler);
  });
}
