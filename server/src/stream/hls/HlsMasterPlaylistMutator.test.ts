import { describe, expect, test } from 'vitest';
import { HlsMasterPlaylistMutator } from './HlsMasterPlaylistMutator.js';
import type { SubtitleRenditionInfo } from './HlsMasterPlaylistMutator.js';

const channelUuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const streamBaseUrl = `/stream/channels/${channelUuid}/hls/`;
const streamNameFormat = 'stream.m3u8';
const subtitleStreamNameFormat = 'subs.m3u8';

describe('HlsMasterPlaylistMutator', () => {
  describe('rewriteVariantPlaylistUrls', () => {
    test('rewrites stream.m3u8 line to absolute variant URL', () => {
      const content = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-STREAM-INF:BANDWIDTH=2000000,CODECS="avc1.640028,mp4a.40.2"',
        'stream.m3u8',
      ].join('\n');

      const result = HlsMasterPlaylistMutator.rewriteVariantPlaylistUrls(
        content,
        undefined,
        { streamBaseUrl, streamNameFormat },
      );

      const joined = result.join('\n');
      expect(joined).toContain(
        `/stream/channels/${channelUuid}/hls/stream.m3u8`,
      );
      expect(joined).not.toMatch(/\nstream\.m3u8/);
    });

    test('preserves non-URI lines unchanged', () => {
      const content = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-STREAM-INF:BANDWIDTH=2000000,CODECS="avc1.640028,mp4a.40.2"',
        'stream.m3u8',
      ].join('\n');

      const result = HlsMasterPlaylistMutator.rewriteVariantPlaylistUrls(
        content,
        undefined,
        { streamBaseUrl, streamNameFormat },
      );

      const joined = result.join('\n');
      expect(joined).toContain('#EXTM3U');
      expect(joined).toContain('#EXT-X-VERSION:3');
      expect(joined).toContain(
        '#EXT-X-STREAM-INF:BANDWIDTH=2000000,CODECS="avc1.640028,mp4a.40.2"',
      );
    });

    test('appends SUBTITLES attribute to #EXT-X-STREAM-INF when rendition is present', () => {
      const content = [
        '#EXTM3U',
        '#EXT-X-STREAM-INF:BANDWIDTH=2000000',
        'stream.m3u8',
      ].join('\n');

      const rendition: SubtitleRenditionInfo = {
        language: 'en',
        default: true,
        forced: false,
      };

      const result = HlsMasterPlaylistMutator.rewriteVariantPlaylistUrls(
        content,
        rendition,
        { streamBaseUrl, streamNameFormat },
      );

      expect(result.join('\n')).toContain(
        '#EXT-X-STREAM-INF:BANDWIDTH=2000000,SUBTITLES="subs"',
      );
    });

    test('does not duplicate SUBTITLES attribute if already present', () => {
      const content = [
        '#EXTM3U',
        '#EXT-X-STREAM-INF:BANDWIDTH=2000000,SUBTITLES="subs"',
        'stream.m3u8',
      ].join('\n');

      const rendition: SubtitleRenditionInfo = {
        language: 'en',
        default: true,
        forced: false,
      };

      const result = HlsMasterPlaylistMutator.rewriteVariantPlaylistUrls(
        content,
        rendition,
        { streamBaseUrl, streamNameFormat },
      );

      const matches = result.join('\n').match(/SUBTITLES=/g);
      expect(matches).toHaveLength(1);
    });
  });

  describe('injectSubtitleMediaTag', () => {
    test('inserts #EXT-X-MEDIA tag before the first #EXT-X-STREAM-INF line', () => {
      const lines = [
        '#EXTM3U',
        '#EXT-X-STREAM-INF:BANDWIDTH=2000000',
        'stream.m3u8',
      ];

      const rendition: SubtitleRenditionInfo = {
        language: 'en',
        languageName: 'English',
        default: true,
        forced: false,
        title: 'English',
      };

      HlsMasterPlaylistMutator.injectSubtitleMediaTag(lines, rendition, {
        streamBaseUrl,
        subtitleStreamNameFormat,
      });

      const streamInfIndex = lines.findIndex((l) =>
        l.startsWith('#EXT-X-STREAM-INF:'),
      );
      expect(lines[streamInfIndex - 1]).toMatch(/^#EXT-X-MEDIA:TYPE=SUBTITLES/);
      expect(lines[streamInfIndex - 1]).toContain('LANGUAGE="en"');
      expect(lines[streamInfIndex - 1]).toContain('NAME="English"');
      expect(lines[streamInfIndex - 1]).toContain('DEFAULT=YES');
      expect(lines[streamInfIndex - 1]).toContain('FORCED=NO');
      expect(lines[streamInfIndex - 1]).toContain(
        `URI="${streamBaseUrl}${subtitleStreamNameFormat}"`,
      );
    });

    test('uses language as name when title and languageName are absent', () => {
      const lines = [
        '#EXTM3U',
        '#EXT-X-STREAM-INF:BANDWIDTH=2000000',
        'stream.m3u8',
      ];

      const rendition: SubtitleRenditionInfo = {
        language: 'fr',
        default: false,
        forced: false,
      };

      HlsMasterPlaylistMutator.injectSubtitleMediaTag(lines, rendition, {
        streamBaseUrl,
        subtitleStreamNameFormat,
      });

      expect(lines.some((l) => l.includes('NAME="fr"'))).toBe(true);
    });
  });
});
