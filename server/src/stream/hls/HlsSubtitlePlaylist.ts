// FFmpeg's segment muxer writes one WebVTT file per cue and nothing for the
// silences between cues, so its subtitle playlist timeline is much shorter than
// the video's. Players place subtitle segments by summing EXTINF durations, so
// the cues land at the wrong time and are never shown. Instead, serve a
// subtitle playlist that mirrors the served video playlist segment for segment,
// where subs<N>.vtt holds the cues that start inside video segment N.

export type Cue = { start: number; block: string };

export const SubtitleWindowRegex = /^subs(\d+)\.vtt$/;

const SegmentLineRegex = /\D+(\d+)\.(ts|mp4)$/;
const CueTimingRegex = /^((?:\d+:)?\d+:\d+(?:\.\d+)?)\s+-->/m;

export function subtitlePlaylistFromVideo(videoPlaylist: string): string {
  return videoPlaylist
    .split('\n')
    .map((line) =>
      line.startsWith('#')
        ? line
        : line.replace(/[^/]*?(\d+)\.(ts|mp4)$/, 'subs$1.vtt'),
    )
    .join('\n');
}

/** Start and end, in seconds from session start, of every segment in the full on-disk playlist. */
export function segmentWindows(
  videoPlaylist: string,
): Map<number, [number, number]> {
  const windows = new Map<number, [number, number]>();
  let time = 0;
  let duration: number | undefined;
  for (const line of videoPlaylist.split('\n')) {
    if (line.startsWith('#EXTINF:')) {
      duration = parseFloat(line.slice('#EXTINF:'.length));
      continue;
    }
    const match = line.match(SegmentLineRegex);
    if (match?.[1] === undefined || duration === undefined) {
      continue;
    }
    windows.set(parseInt(match[1]), [time, time + duration]);
    time += duration;
    duration = undefined;
  }
  return windows;
}

export function parseCues(vtt: string): Cue[] {
  const cues: Cue[] = [];
  for (const block of vtt.split(/\r?\n\r?\n/)) {
    const timing = block.match(CueTimingRegex)?.[1];
    if (timing === undefined) {
      continue;
    }
    const start = timing
      .split(':')
      .reduce((total, part) => total * 60 + parseFloat(part), 0);
    cues.push({ start, block: block.trim() });
  }
  return cues;
}

export function subtitleWindowVtt(cues: Cue[], start: number, end: number) {
  const blocks = cues
    .filter((cue) => cue.start >= start && cue.start < end)
    .sort((a, b) => a.start - b.start)
    .map((cue) => cue.block);
  return ['WEBVTT', '', ...blocks.map((block) => `${block}\n`)].join('\n');
}

/** Lowest cue file number that still has a cue starting at or after `from`. */
export function firstNeededCueFile(
  cueFiles: Map<number, Cue[]>,
  from: number,
): number | undefined {
  const needed = [...cueFiles]
    .filter(([, cues]) => cues.some((cue) => cue.start >= from))
    .map(([number]) => number);
  return needed.length > 0 ? Math.min(...needed) : undefined;
}
