import { FfmpegCapabilities } from '../../capabilities/FfmpegCapabilities.ts';
import { KnownFfmpegOptions } from '../KnownFfmpegOptions.ts';
import {
  ReadrateCatchupSpeed,
  ReadrateInputOption,
} from './ReadrateInputOption.ts';

function capabilitiesWith(...options: string[]) {
  return new FfmpegCapabilities(
    new Set(options),
    new Map(),
    new Set(),
    new Set(),
  );
}

describe('ReadrateInputOption', () => {
  test('omits the catch-up rate when ffmpeg lacks the option', () => {
    const option = new ReadrateInputOption(capabilitiesWith(), 0);

    expect(option.options()).toEqual(['-readrate', '1']);
  });

  test('sets a high catch-up rate when ffmpeg supports it', () => {
    const option = new ReadrateInputOption(
      capabilitiesWith(KnownFfmpegOptions.ReadrateCatchup),
      0,
    );

    expect(option.options()).toEqual([
      '-readrate',
      '1',
      '-readrate_catchup',
      `${ReadrateCatchupSpeed}`,
    ]);
  });

  test('keeps the catch-up rate at or above the readrate', () => {
    const option = new ReadrateInputOption(
      capabilitiesWith(KnownFfmpegOptions.ReadrateCatchup),
      0,
      ReadrateCatchupSpeed * 2,
    );

    expect(option.options()).toContain(`${ReadrateCatchupSpeed * 2}`);
    expect(option.options()).not.toContain(`${ReadrateCatchupSpeed}`);
  });

  test('sets both the initial burst and the catch-up rate', () => {
    const option = new ReadrateInputOption(
      capabilitiesWith(
        KnownFfmpegOptions.ReadrateInitialBurst,
        KnownFfmpegOptions.ReadrateCatchup,
      ),
      60,
    );

    expect(option.options()).toEqual([
      '-readrate',
      '1',
      '-readrate_initial_burst',
      '60',
      '-readrate_catchup',
      `${ReadrateCatchupSpeed}`,
    ]);
  });
});
