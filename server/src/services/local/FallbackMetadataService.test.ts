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
});
