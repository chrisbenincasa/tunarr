import { ffmpegKeepsCudaFrameSize } from './NvidiaCropBottomBitstreamFilter.ts';

describe('ffmpegKeepsCudaFrameSize', () => {
  test.each([
    ['n8.1.2-etv.7', 8],
    ['8.1.2-etv.7', 8],
    ['n8.1.2-etv-gb138f203-20260722', 8],
  ])('true for ErsatzTV build %s', (versionString, majorVersion) => {
    expect(
      ffmpegKeepsCudaFrameSize({
        versionString,
        majorVersion,
        isUnknown: false,
      }),
    ).toBe(true);
  });

  test.each([
    ['n7.1.1-56-gc2184b65d2-20250716', 7],
    ['8.0.1-3ubuntu2', 8],
    ['n8.1.2', 8],
  ])('false for unpatched build %s', (versionString, majorVersion) => {
    expect(
      ffmpegKeepsCudaFrameSize({
        versionString,
        majorVersion,
        isUnknown: false,
      }),
    ).toBe(false);
  });

  test('false for an unknown version', () => {
    expect(
      ffmpegKeepsCudaFrameSize({ versionString: 'unknown', isUnknown: true }),
    ).toBe(false);
  });
});
