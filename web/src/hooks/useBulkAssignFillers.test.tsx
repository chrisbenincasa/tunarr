import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getChannelsByNumberV2Options } from '../generated/@tanstack/react-query.gen.ts';
import type * as Sdk from '../generated/sdk.gen.ts';
import { useBulkAssignFillers } from './useBulkAssignFillers.tsx';

const mocks = vi.hoisted(() => ({
  enqueueSnackbar: vi.fn(),
  bulkAssignFillers: vi.fn(),
}));

vi.mock('notistack', () => ({
  useSnackbar: () => ({ enqueueSnackbar: mocks.enqueueSnackbar }),
}));

vi.mock('../generated/sdk.gen.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof Sdk>()),
  bulkAssignFillers: mocks.bulkAssignFillers,
}));

const body = {
  channelIds: ['channel-1', 'channel-2'],
  fillers: [{ fillerShowId: 'filler-a', weight: 50, cooldownSeconds: 30 }],
  mode: 'add' as const,
};

function renderBulkAssign(onSuccess: () => void) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const { result } = renderHook(() => useBulkAssignFillers(onSuccess), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <I18nProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </I18nProvider>
    ),
  });
  return { result, invalidate };
}

function badRequest(data: unknown) {
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, null, {
    data,
    status: 400,
    statusText: 'Bad Request',
    headers: {},
    config: { headers: new AxiosHeaders() },
  });
}

beforeEach(() => {
  mocks.enqueueSnackbar.mockReset();
  mocks.bulkAssignFillers.mockReset();
});

describe('useBulkAssignFillers', () => {
  test('on success, reports the counts and refreshes each channel', async () => {
    mocks.bulkAssignFillers.mockResolvedValue({
      data: { added: 2, updated: 1 },
    });
    const onSuccess = vi.fn();
    const { result, invalidate } = renderBulkAssign(onSuccess);

    result.current.mutate({ body });

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(mocks.enqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'success' }),
    );
    expect(invalidate).toHaveBeenCalledTimes(2);
    for (const id of body.channelIds) {
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: getChannelsByNumberV2Options({ path: { id } }).queryKey,
      });
    }
  });

  test('on a 400, shows the server message and does not close', async () => {
    mocks.bulkAssignFillers.mockRejectedValue(
      badRequest({ message: 'channelIds must not contain duplicates' }),
    );
    const onSuccess = vi.fn();
    const { result, invalidate } = renderBulkAssign(onSuccess);

    result.current.mutate({ body });

    await waitFor(() =>
      expect(mocks.enqueueSnackbar).toHaveBeenCalledWith({
        message:
          'Error assigning fillers: channelIds must not contain duplicates',
        variant: 'error',
      }),
    );
    expect(onSuccess).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });
});
