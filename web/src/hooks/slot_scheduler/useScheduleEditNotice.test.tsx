import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useScheduleEditNotice } from './useScheduleEditNotice.ts';

const mocks = vi.hoisted(() => ({ enqueueSnackbar: vi.fn() }));

vi.mock('notistack', () => ({
  useSnackbar: () => ({ enqueueSnackbar: mocks.enqueueSnackbar }),
}));

function notify() {
  const { result } = renderHook(() => useScheduleEditNotice(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <I18nProvider i18n={i18n}>{children}</I18nProvider>
    ),
  });
  return result.current;
}

describe('useScheduleEditNotice', () => {
  beforeEach(() => {
    mocks.enqueueSnackbar.mockReset();
  });

  test('stays quiet when places carried', () => {
    notify()({ placesCarried: true });
    expect(mocks.enqueueSnackbar).not.toHaveBeenCalled();
  });

  test('stays quiet on a save that had no schedule before', () => {
    notify()({ placesCarried: false, reason: 'no_schedule' });
    expect(mocks.enqueueSnackbar).not.toHaveBeenCalled();
  });

  test('stays quiet on a save outside a rebuilding channel', () => {
    notify()(undefined);
    expect(mocks.enqueueSnackbar).not.toHaveBeenCalled();
  });

  test.each(['no_seed', 'replay_mismatch'] as const)(
    'warns when places were lost (%s)',
    (reason) => {
      notify()({ placesCarried: false, reason });
      expect(mocks.enqueueSnackbar).toHaveBeenCalledWith(
        expect.stringContaining('Shows start from the beginning'),
        { variant: 'warning' },
      );
    },
  );

  test('informs when nothing has aired yet', () => {
    notify()({ placesCarried: false, reason: 'not_started' });
    expect(mocks.enqueueSnackbar).toHaveBeenCalledWith(
      expect.stringContaining('nothing has aired'),
      { variant: 'info' },
    );
  });
});
