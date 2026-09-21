import { describe, expect, test } from 'vitest';
import type { VaapiDriver } from './generated/channelConfig.ts';
import { VaapiDriverSchema } from './generated/channelConfig.ts';
import { DefaultVaapiDevice, resolveVaapi } from './EtvNextVaapi.ts';

const supported = new Set<string>(VaapiDriverSchema.options);
const isSupportedDriver = (value: string): value is VaapiDriver =>
  supported.has(value);

const resolve = (overrides: Partial<Parameters<typeof resolveVaapi>[0]> = {}) =>
  resolveVaapi({
    vaapiDevice: null,
    vaapiDriver: 'system',
    isSupportedDriver,
    resolveDriver: () => undefined,
    defaultDevice: DefaultVaapiDevice,
    ...overrides,
  });

describe('resolveVaapi', () => {
  test('passes an explicit device and driver through untouched', () => {
    expect(
      resolve({ vaapiDevice: '/dev/dri/renderD129', vaapiDriver: 'radeonsi' }),
    ).toEqual({ device: '/dev/dri/renderD129', driver: 'radeonsi' });
  });

  test('falls back to the default render node when none is named', () => {
    expect(resolve({ resolveDriver: () => 'ihd' })).toEqual({
      device: DefaultVaapiDevice,
      driver: 'ihd',
    });
  });

  test('treats an empty device string as unset', () => {
    expect(resolve({ vaapiDevice: '', resolveDriver: () => 'ihd' })).toEqual({
      device: DefaultVaapiDevice,
      driver: 'ihd',
    });
  });

  test('infers a driver only for `system`', () => {
    const resolveDriver = () => 'ihd' as const;

    expect(resolve({ vaapiDriver: 'system', resolveDriver }).driver).toBe(
      'ihd',
    );
    // `nouveau` is a real choice the user made that the backend cannot honor,
    // so it is dropped rather than quietly replaced with something else.
    expect(resolve({ vaapiDriver: 'nouveau', resolveDriver }).driver).toBe(
      undefined,
    );
  });

  test('asks the resolver about the device it settled on, not the raw config', () => {
    const seen: string[] = [];
    resolve({
      vaapiDevice: null,
      resolveDriver: (device) => {
        seen.push(device);
        return undefined;
      },
    });

    expect(seen).toEqual([DefaultVaapiDevice]);
  });

  test('yields nothing when there is no device to work from', () => {
    expect(
      resolve({ defaultDevice: null, resolveDriver: () => 'ihd' }),
    ).toEqual({ device: undefined, driver: undefined });
  });
});
