/**
 * The worker writes `live.m3u8`, which is a media playlist. Upstream's server
 * synthesizes the `#EXT-X-STREAM-INF` wrapper around it at request time
 * (`get_multi_variant`), and Tunarr does not run that server, so the wrapper is
 * built here instead against Tunarr-shaped URLs.
 */

/** The worker's own output filenames, fixed upstream. */
export const EtvNextOutputFiles = {
  MediaPlaylist: 'live.m3u8',
  SubtitlePlaylist: 'live_sub.m3u8',
  ReadyFile: '.ready',
  HeartbeatFile: '.heartbeat',
} as const;

export type EtvNextPlaylistOptions = {
  /** Absolute or root-relative URL the worker's output is served under, with a trailing slash. */
  streamBaseUrl: string;
  videoBitrateKbps: number;
  audioBitrateKbps: number;

  /**
   * Whether to advertise the WebVTT rendition the worker always writes.
   * Gated by the `webvttSidecarEnabled` flag so behaviour matches the other
   * HLS modes, which burn subtitles in when it is off.
   */
  includeSubtitles: boolean;
};

/**
 * Upstream's bandwidth arithmetic, kept identical so a channel advertises the
 * same number under either backend. The 10% covers HLS container overhead.
 */
export function bandwidthBps(
  videoBitrateKbps: number,
  audioBitrateKbps: number,
): number {
  return (videoBitrateKbps + audioBitrateKbps) * 1100;
}

/** Builds the multivariant playlist that fronts the worker's media playlist. */
export function createMultivariantPlaylist({
  streamBaseUrl,
  videoBitrateKbps,
  audioBitrateKbps,
  includeSubtitles,
}: EtvNextPlaylistOptions): string {
  const base = streamBaseUrl.endsWith('/')
    ? streamBaseUrl
    : `${streamBaseUrl}/`;
  const lines = ['#EXTM3U', '#EXT-X-VERSION:6'];

  if (includeSubtitles) {
    lines.push(
      '#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",' +
        'DEFAULT=YES,AUTOSELECT=YES,FORCED=NO,LANGUAGE="en",' +
        `URI="${base}${EtvNextOutputFiles.SubtitlePlaylist}"`,
    );
  }

  const bandwidth = bandwidthBps(videoBitrateKbps, audioBitrateKbps);
  lines.push(
    includeSubtitles
      ? `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},SUBTITLES="subs"`
      : `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth}`,
  );
  lines.push(`${base}${EtvNextOutputFiles.MediaPlaylist}`);

  return `${lines.join('\n')}\n`;
}
