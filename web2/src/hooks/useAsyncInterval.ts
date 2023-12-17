import { useEffect, useRef } from 'react';
import { useIsomorphicLayoutEffect } from 'usehooks-ts';
import { AsyncInterval } from '../helpers/AsyncInterval';

export function useAsyncInterval(
  callback: () => Promise<void>,
  delay: number | null,
) {
  console.log(delay);
  const savedCallback = useRef(new AsyncInterval(callback, delay));

  // Remember the latest callback if it changes.
  useIsomorphicLayoutEffect(() => {
    savedCallback.current = new AsyncInterval(callback, delay);
  }, [callback, delay]);

  // Set up the interval.
  useEffect(() => {
    // Don't schedule if no delay is specified.
    // Note: 0 is a valid value for delay.
    if (!delay && delay !== 0) {
      return;
    }

    console.log('effect', delay);

    savedCallback.current.start();

    return () => savedCallback.current.stop();
  }, [delay]);
}

export async function delay(ms: number) {
  return new Promise((res) => setTimeout(() => res(void 0), ms));
}
