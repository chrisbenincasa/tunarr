export type SubtitleRenditionInfo = {
  language: string;
  languageName?: string;
  default: boolean;
  forced: boolean;
  title?: string;
};

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

  static rewriteVariantPlaylistUrls(
    content: string,
    rendition: SubtitleRenditionInfo | undefined,
    options: RewriteOptions,
  ): string[] {
    const { streamBaseUrl, streamNameFormat } = options;
    const variantAbsUrl = `${streamBaseUrl}${streamNameFormat}`;
    return content.split('\n').map((line) => {
      if (line.trim() === streamNameFormat) return variantAbsUrl;
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

  private static getYesNo(v: boolean) {
    return v ? 'YES' : 'NO';
  }
}
