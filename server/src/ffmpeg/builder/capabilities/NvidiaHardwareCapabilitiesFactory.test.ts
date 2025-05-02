import { parseNvidiaModelAndArchitecture } from './NvidiaHardwareCapabilitiesFactory.ts';

describe('parseNvidiaModelAndArchitecture', () => {
  test('GTX 1080', () => {
    const debugLine =
      '[h264_nvenc @ 0x635a172cd900] [ GPU #0 - < NVIDIA GeForce GTX 1080 > has Compute SM 6.1 ]';
    const maybeParsed = parseNvidiaModelAndArchitecture(debugLine);
    expect(maybeParsed).toMatchObject({
      model: 'GTX 1080',
      architecture: 61,
    });
  });

  test('RTX 2080 Ti', () => {
    const debugLine =
      '[h264_nvenc @ 000001bca00c6f40] [ GPU #0 - < NVIDIA GeForce RTX 2080 Ti > has Compute SM 7.5 ]';
    const maybeParsed = parseNvidiaModelAndArchitecture(debugLine);
    expect(maybeParsed).toMatchObject({
      model: 'RTX 2080 Ti',
      architecture: 75,
    });
  });

  test('Quadro P2000', () => {
    const debugLine =
      '[h264_nvenc @ 0x4870fc0] [ GPU #0 - < Quadro P2000 > has Compute SM 6.1 ]';
    const maybeParsed = parseNvidiaModelAndArchitecture(debugLine);
    expect(maybeParsed).toMatchObject({
      model: 'Quadro P2000',
      architecture: 61,
    });
  });
});
