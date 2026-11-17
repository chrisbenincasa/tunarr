import type { QueryKey } from '@tanstack/react-query';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { shouldNotifyQueryError } from './queryErrorSnackbar.ts';

const fail = () => Promise.reject(new Error('boom'));

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const notified: QueryKey[] = [];
  const unsubscribeCache = client.getQueryCache().subscribe((event) => {
    if (shouldNotifyQueryError(event)) {
      notified.push(event.query.queryKey);
    }
  });
  return { client, notified, unsubscribeCache };
}

function watch(observer: QueryObserver<unknown, Error>) {
  const unsubscribe = observer.subscribe(() => {});
  cleanups.push(unsubscribe);
  return observer;
}

async function waitForError(observer: QueryObserver<unknown, Error>) {
  await vi.waitFor(() =>
    expect(observer.getCurrentResult().isError).toBe(true),
  );
  await tick();
}

const cleanups: Array<() => void> = [];

afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
});

describe('shouldNotifyQueryError', () => {
  test('notifies when a watched query fails before it ever loads', async () => {
    const { client, notified } = setup();
    const observer = watch(
      new QueryObserver<unknown, Error>(client, {
        queryKey: ['a'],
        queryFn: fail,
      }),
    );

    await waitForError(observer);

    expect(notified).toEqual([['a']]);
  });

  test('notifies when the only data is an initialData placeholder', async () => {
    const { client, notified } = setup();
    const observer = watch(
      new QueryObserver<unknown, Error>(client, {
        queryKey: ['a'],
        queryFn: fail,
        initialData: [],
        staleTime: 0,
      }),
    );

    await waitForError(observer);

    expect(notified).toEqual([['a']]);
  });

  test('skips a failed refetch when earlier data is still on screen', async () => {
    const { client, notified } = setup();
    let calls = 0;
    const observer = watch(
      new QueryObserver<unknown, Error>(client, {
        queryKey: ['a'],
        queryFn: () => (calls++ === 0 ? Promise.resolve('ok') : fail()),
      }),
    );
    await vi.waitFor(() =>
      expect(observer.getCurrentResult().isSuccess).toBe(true),
    );

    await observer.refetch();
    await waitForError(observer);

    expect(notified).toEqual([]);
  });

  test('skips queries that opt out through meta', async () => {
    const { client, notified } = setup();
    const observer = watch(
      new QueryObserver<unknown, Error>(client, {
        queryKey: ['a'],
        queryFn: fail,
        meta: { suppressErrorSnackbar: true },
      }),
    );

    await waitForError(observer);

    expect(notified).toEqual([]);
  });

  test('skips fetches no component is watching', async () => {
    const { client, notified } = setup();

    await expect(
      client.fetchQuery({ queryKey: ['a'], queryFn: fail }),
    ).rejects.toThrow('boom');
    await tick();

    expect(notified).toEqual([]);
  });

  test('skips canceled fetches', async () => {
    const { client, notified } = setup();
    const observer = watch(
      new QueryObserver<unknown, Error>(client, {
        queryKey: ['a'],
        queryFn: () => new Promise<never>(() => {}),
      }),
    );
    await vi.waitFor(() =>
      expect(observer.getCurrentResult().fetchStatus).toBe('fetching'),
    );

    await client.cancelQueries({ queryKey: ['a'] });
    await tick();

    expect(notified).toEqual([]);
  });
});
