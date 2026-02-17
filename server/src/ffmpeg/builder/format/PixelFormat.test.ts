import { KnownPixelFormats, PixelFormatYuv420P } from './PixelFormat.ts';

describe('KnownPixelFormats', () => {
  test('forPixelFormat yuv420p', () => {
    const format = KnownPixelFormats.forPixelFormat('yuv420p');
    expect(format).toBeInstanceOf(PixelFormatYuv420P);
  });
});
