import fs from 'node:fs';
import path from 'node:path';
import type { Maybe } from '../../types/util.ts';
import { isLinux, isNonEmptyString } from '../../util/index.ts';
import type { VaapiDriver } from './generated/channelConfig.ts';

/**
 * The render node Tunarr assumes when a transcode config names none, matching
 * `FfmpegStreamFactory.getVaapiDevice` and `VaapiHardwareCapabilitiesFactory`.
 */
export const DefaultVaapiDevice = '/dev/dri/renderD128';

/**
 * PCI vendor ids, as `/sys/class/drm/<node>/device/vendor` reports them.
 *
 * NVIDIA is absent deliberately: its VAAPI driver is `nouveau`, which the
 * backend has no counterpart for, so the caller warns instead of guessing.
 */
const VaapiDriverByPciVendor: Record<string, VaapiDriver> = {
  '0x8086': 'ihd',
  '0x1002': 'radeonsi',
  '0x1022': 'radeonsi',
};

/** Reads the driver a render node implies, or nothing when it cannot tell. */
export type VaapiDriverResolver = (devicePath: string) => Maybe<VaapiDriver>;

/**
 * Infers the VAAPI driver from the render node's PCI vendor id.
 *
 * Tunarr's own pipeline lets libva pick when the user leaves the driver on
 * `system`, but the backend refuses to accelerate at all unless the driver is
 * named (ErsatzTV/next#246), so Tunarr has to name one.
 *
 * Intel maps to `ihd` rather than `i965`, which is right for Broadwell and
 * newer and wrong only for hardware `ihd` never supported. A wrong guess is
 * not a regression: the backend's own probe then fails and it falls back to
 * software, which is exactly what naming no driver already does.
 */
export const inferVaapiDriver: VaapiDriverResolver = (devicePath) => {
  const node = path.basename(devicePath);
  try {
    const vendor = fs
      .readFileSync(`/sys/class/drm/${node}/device/vendor`, 'utf-8')
      .trim()
      .toLowerCase();
    return VaapiDriverByPciVendor[vendor];
  } catch {
    return undefined;
  }
};

export type ResolvedVaapi = {
  device: Maybe<string>;
  driver: Maybe<VaapiDriver>;
};

/**
 * Settles the device and driver a `vaapi` channel config should carry.
 *
 * The backend reads hardware acceleration only when both are present, so a
 * result missing either means the channel transcodes in software.
 */
export function resolveVaapi({
  vaapiDevice,
  vaapiDriver,
  isSupportedDriver,
  resolveDriver = inferVaapiDriver,
  defaultDevice = isLinux() ? DefaultVaapiDevice : null,
}: {
  vaapiDevice: string | null;
  vaapiDriver: string;
  isSupportedDriver: (value: string) => value is VaapiDriver;
  resolveDriver?: VaapiDriverResolver;

  /** `null` means there is no render node to fall back to, as off Linux. */
  defaultDevice?: string | null;
}): ResolvedVaapi {
  const device = isNonEmptyString(vaapiDevice) ? vaapiDevice : defaultDevice;

  if (device === null) {
    return { device: undefined, driver: undefined };
  }

  // `system` is Tunarr's "let libva decide", which the backend cannot express.
  const driver = isSupportedDriver(vaapiDriver)
    ? vaapiDriver
    : vaapiDriver === 'system'
      ? resolveDriver(device)
      : undefined;

  return { device, driver };
}
