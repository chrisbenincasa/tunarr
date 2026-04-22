import type { AudioRenditionInfo, SubtitleRenditionInfo } from '../types.ts';
export type { SubtitleRenditionInfo };

type RewriteOptions = {
  streamBaseUrl: string;
  streamNameFormat: string;
};

type InjectOptions = {
  streamBaseUrl: string;
  subtitleStreamNameFormat: string;
};

export class HlsMasterPlaylistMutator {
  private static readonly _variantPlaylistTag = '#EXT-X-STREAM-INF:';
  private static readonly _mediaTag = '#EXT-X-MEDIA:';

  static rewriteVariantPlaylistUrls(
    content: string,
    rendition: SubtitleRenditionInfo | undefined,
    options: RewriteOptions,
  ): string[] {
    const { streamBaseUrl, streamNameFormat } = options;
    const variantAbsUrl = `${streamBaseUrl}${streamNameFormat}`;
    return content.split('\n').map((line) => {
      if (line.trim() === streamNameFormat) return variantAbsUrl;

      // Rewrite relative URIs in EXT-X-MEDIA tags to absolute URLs
      // so clients can resolve them regardless of the playlist's base URL.
      if (line.startsWith(this._mediaTag)) {
        return line.replace(
          /URI="([^"]+)"/,
          (_match, uri: string) =>
            `URI="${uri.startsWith('/') || uri.startsWith('http') ? uri : streamBaseUrl + uri}"`,
        );
      }

      const hasSubtitlesAndIsMissingReference =
        rendition &&
        line.startsWith(this._variantPlaylistTag) &&
        !line.includes('SUBTITLES=');
      return hasSubtitlesAndIsMissingReference
        ? line + ',SUBTITLES="subs"'
        : line;
    });
  }

  static injectSubtitleMediaTag(
    lines: string[],
    rendition: SubtitleRenditionInfo,
    options: InjectOptions,
  ): void {
    const { streamBaseUrl, subtitleStreamNameFormat } = options;
    const subsUrl = `${streamBaseUrl}${subtitleStreamNameFormat}`;
    const langName = rendition.languageName ?? rendition.language;
    const title = rendition.title ?? langName;
    const mediaTag = `#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",LANGUAGE="${rendition.language}",NAME="${title}",DEFAULT=${this.getYesNo(rendition.default)},AUTOSELECT=${this.getYesNo(rendition.default)},FORCED=${this.getYesNo(rendition.forced)},URI="${subsUrl}"`;
    const insertBefore = lines.findIndex((l) =>
      l.startsWith(this._variantPlaylistTag),
    );
    if (insertBefore >= 0) lines.splice(insertBefore, 0, mediaTag);
  }

  static injectAudioMediaTags(
    lines: string[],
    audioRenditions: AudioRenditionInfo[],
    options: Pick<RewriteOptions, 'streamBaseUrl'>,
  ): void {
    if (audioRenditions.length === 0) return;

    const insertBefore = lines.findIndex((l) =>
      l.startsWith(this._variantPlaylistTag),
    );
    if (insertBefore < 0) return;

    const mediaTags: string[] = [];
    for (let i = 0; i < audioRenditions.length; i++) {
      const rendition = audioRenditions[i]!;
      const isDefault = rendition.default;
      const langName = rendition.languageName ?? rendition.language;
      const title = rendition.title ?? langName;
      // The default rendition is muxed with video, so no URI is needed.
      // Alternate renditions also reference the same muxed segments since
      // all audio tracks are interleaved in the same TS output.
      const uriPart = isDefault ? '' : `,URI="${options.streamBaseUrl}stream.m3u8"`;
      const channelsPart =
        rendition.channels != null
          ? `,CHANNELS="${rendition.channels}"`
          : '';
      mediaTags.push(
        `#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",LANGUAGE="${rendition.language}",NAME="${title}",DEFAULT=${this.getYesNo(isDefault)},AUTOSELECT=${this.getYesNo(isDefault)}${channelsPart}${uriPart}`,
      );
    }

    lines.splice(insertBefore, 0, ...mediaTags);

    // Add AUDIO group reference to the variant stream-inf line
    for (let i = 0; i < lines.length; i++) {
      if (
        lines[i]!.startsWith(this._variantPlaylistTag) &&
        !lines[i]!.includes('AUDIO=')
      ) {
        lines[i] = lines[i] + ',AUDIO="audio"';
      }
    }
  }

  private static getYesNo(v: boolean) {
    return v ? 'YES' : 'NO';
  }
}
