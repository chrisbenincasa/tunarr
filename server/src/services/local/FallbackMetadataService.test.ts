import { FallbackMetadataService } from './FallbackMetadataService.ts';

describe('FallbackMetadataService', () => {
  describe('movie fallback metadata', () => {
    const service = new FallbackMetadataService();

    test('extract title and year', () => {
      const result = service.getMovieFallbackMetadata(
        '/data/Eyes Wide Shut (1999)/Eyes Wide Shut (1999) {imdb-tt0120663} [Bluray-1080p][AC3 5.1][x264]-CtrlHD.mkv',
      );
      expect(result).toMatchObject({
        title: 'Eyes Wide Shut',
        year: 1999,
        identifiers: [{ id: 'tt0120663', type: 'imdb' }],
      });
    });

    test('succeeds with unrecognized metadata', () => {
      const result = service.getMovieFallbackMetadata(
        '/data/Eyes Wide Shut (1999)/Eyes Wide Shut (1999) {another-239840} [Bluray-1080p][AC3 5.1][x264]-CtrlHD.mkv',
      );
      expect(result).toMatchObject({
        title: 'Eyes Wide Shut',
        year: 1999,
        identifiers: [],
      });
    });
  });

  describe('other video fallback metadata', () => {
    const service = new FallbackMetadataService();

    test('extracts the title and leaves summary fields empty', () => {
      const result = service.getOtherVideoFallbackMetadata(
        '/data/filler/commercial-01.mkv',
      );

      expect(result).toMatchObject({
        title: 'commercial-01',
        type: 'other_video',
        summary: null,
        plot: null,
        tagline: null,
      });
    });
  });
});
