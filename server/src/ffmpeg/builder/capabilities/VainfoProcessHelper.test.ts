import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ChildProcessHelper } from '../../../util/ChildProcessHelper.ts';
import { VainfoProcessHelper } from './VainfoProcessHelper.ts';

describe('VainfoProcessHelper.getVainfoOutput', () => {
  const getStdout = vi.spyOn(ChildProcessHelper.prototype, 'getStdout');

  beforeEach(() => {
    getStdout.mockReset();
    getStdout.mockResolvedValue('vainfo output');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function passedEnv() {
    expect(getStdout).toHaveBeenCalledOnce();
    return getStdout.mock.calls[0]?.[2]?.env;
  }

  test('keeps the server environment when a driver is set', async () => {
    vi.stubEnv('PATH', '/opt/test/bin:/usr/bin');
    vi.stubEnv('LIBVA_DRIVERS_PATH', '/opt/test/dri');

    await new VainfoProcessHelper().getVainfoOutput(
      'drm',
      '/dev/dri/renderD128',
      'iHD',
    );

    expect(passedEnv()).toMatchObject({
      PATH: '/opt/test/bin:/usr/bin',
      LIBVA_DRIVERS_PATH: '/opt/test/dri',
      LIBVA_DRIVER_NAME: 'iHD',
    });
  });

  test('the configured driver overrides an inherited LIBVA_DRIVER_NAME', async () => {
    vi.stubEnv('LIBVA_DRIVER_NAME', 'i965');

    await new VainfoProcessHelper().getVainfoOutput(
      'drm',
      '/dev/dri/renderD128',
      'iHD',
    );

    expect(passedEnv()?.LIBVA_DRIVER_NAME).toBe('iHD');
  });

  test.each(['', null, undefined])(
    'passes no env override when the driver is %j',
    async (driver) => {
      await new VainfoProcessHelper().getVainfoOutput(
        'drm',
        '/dev/dri/renderD128',
        driver,
      );

      expect(passedEnv()).toBeUndefined();
    },
  );
});
