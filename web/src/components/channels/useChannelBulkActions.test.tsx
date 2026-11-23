import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { Channel } from '@tunarr/types';
import { SnackbarProvider } from 'notistack';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { runEach, useChannelBulkActions } from './useChannelBulkActions.ts';

const { createChannel, deleteChannel, enqueueSnackbar } = vi.hoisted(() => ({
  createChannel: vi.fn(),
  deleteChannel: vi.fn(),
  enqueueSnackbar: vi.fn(),
}));

// Keep the real useCreateChannel: its onSuccess is what refreshes the channel
// list, so the invalidation asserted below is the one production runs.
vi.mock('@/generated/@tanstack/react-query.gen.ts', () => ({
  createChannelV2Mutation: () => ({ mutationFn: createChannel }),
}));

vi.mock('@/generated/sdk.gen.ts', () => ({
  deleteApiChannelsById: deleteChannel,
}));

vi.mock('notistack', async (importOriginal) => {
  const actual = await importOriginal<typeof import('notistack')>();
  return { ...actual, useSnackbar: () => ({ enqueueSnackbar }) };
});

const wrapperFor = (queryClient: QueryClient) => {
  return ({ children }: { children: ReactNode }) => (
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <SnackbarProvider>{children}</SnackbarProvider>
      </QueryClientProvider>
    </I18nProvider>
  );
};

const channel = (id: string): Channel =>
  ({ id, name: id, number: 1 }) as Channel;

const newClient = () => new QueryClient();

describe('runEach', () => {
  test('runs tasks one at a time in order', async () => {
    const order: string[] = [];
    let running = 0;
    const result = await runEach(['a', 'b', 'c'], async (item) => {
      running++;
      expect(running).toBe(1);
      await Promise.resolve();
      order.push(item);
      running--;
    });
    expect(order).toEqual(['a', 'b', 'c']);
    expect(result).toEqual({ succeeded: 3, failed: 0 });
  });

  test('keeps going after a failure and counts it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const seen: number[] = [];
    const result = await runEach([1, 2, 3], async (n) => {
      seen.push(n);
      if (n === 2) {
        throw new Error('boom');
      }
    });
    expect(seen).toEqual([1, 2, 3]);
    expect(result).toEqual({ succeeded: 2, failed: 1 });
  });
});

describe('useChannelBulkActions', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test('drops a second duplicate while the first one is running', async () => {
    let release!: () => void;
    createChannel.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const queryClient = newClient();
    const { result } = renderHook(() => useChannelBulkActions(), {
      wrapper: wrapperFor(queryClient),
    });

    let first!: Promise<void>;
    act(() => {
      first = result.current.duplicateChannels([channel('a')]);
    });
    await waitFor(() => expect(result.current.isDuplicating).toBe(true));

    act(() => {
      void result.current.duplicateChannels([channel('b')]);
    });
    expect(createChannel).toHaveBeenCalledTimes(1);

    await act(async () => {
      release();
      await first;
    });

    expect(createChannel).toHaveBeenCalledTimes(1);
    expect(result.current.isDuplicating).toBe(false);
  });

  test('duplicates again once the first run finished', async () => {
    createChannel.mockResolvedValue(undefined);
    const queryClient = newClient();
    const { result } = renderHook(() => useChannelBulkActions(), {
      wrapper: wrapperFor(queryClient),
    });

    await act(async () => {
      await result.current.duplicateChannels([channel('a')]);
    });
    await act(async () => {
      await result.current.duplicateChannels([channel('a')]);
    });

    expect(createChannel).toHaveBeenCalledTimes(2);
  });

  test('reports a success and refreshes the channel list per copy', async () => {
    createChannel.mockResolvedValue(undefined);
    const queryClient = newClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useChannelBulkActions(), {
      wrapper: wrapperFor(queryClient),
    });

    await act(async () => {
      await result.current.duplicateChannels([channel('a'), channel('b')]);
    });

    expect(createChannel).toHaveBeenCalledWith({
      body: { type: 'copy', channelId: 'a' },
    });
    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.any(String), {
      variant: 'success',
    });
  });

  test('keeps copying after a failure and reports it once', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    createChannel
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('boom'));
    const queryClient = newClient();
    const { result } = renderHook(() => useChannelBulkActions(), {
      wrapper: wrapperFor(queryClient),
    });

    await act(async () => {
      await result.current.duplicateChannels([channel('a'), channel('b')]);
    });

    expect(createChannel).toHaveBeenCalledTimes(2);
    expect(enqueueSnackbar).toHaveBeenCalledTimes(1);
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.any(String), {
      variant: 'error',
    });
  });

  test('delete refreshes the channel list and reports the result', async () => {
    deleteChannel.mockResolvedValue(undefined);
    const queryClient = newClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useChannelBulkActions(), {
      wrapper: wrapperFor(queryClient),
    });

    await act(async () => {
      await result.current.deleteChannels([channel('a')]);
    });

    expect(deleteChannel).toHaveBeenCalledWith({
      path: { id: 'a' },
      throwOnError: true,
    });
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.any(String), {
      variant: 'success',
    });
  });
});
