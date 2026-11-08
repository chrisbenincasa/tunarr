import type {
  Channel,
  ChannelLineup,
  ChannelSession,
  MediaArtwork,
  TerminalProgram,
  TvGuideProgram,
} from '@tunarr/types';
import { clamp, isNil, padStart, sumBy } from 'lodash-es';
import { match, P } from 'ts-pattern';
import { extractProgramGrandparent } from '../../helpers/programUtil.ts';

// Wide art first, so it fills a card or a banner without heavy cropping.
export const programArtworkUrl = (
  backendUri: string,
  program: TerminalProgram,
) => {
  const [id, artworkType, fallbackTypes] = match([
    program,
    extractProgramGrandparent(program),
  ])
    .returnType<[string, MediaArtwork['type'], MediaArtwork['type'][]]>()
    .with([{ type: 'episode' }, P.nonNullable], ([_, show]) => [
      show.uuid,
      'fanart',
      ['poster'],
    ])
    .with([{ type: 'episode' }, P._], ([ep, _]) => [ep.uuid, 'thumbnail', []])
    .with([{ type: 'track' }, P.nonNullable], ([_, artist]) => [
      artist.uuid,
      'banner',
      ['fanart', 'poster'],
    ])
    .with([{ type: 'movie' }, P._], ([movie, _]) => [
      movie.uuid,
      'banner',
      ['fanart', 'poster'],
    ])
    .otherwise(([other, _]) => [other.uuid, 'fanart', ['poster']]);

  const url = `${backendUri}/api/programs/${id}/artwork/${artworkType}`;

  // The server rejects an empty fallback list with a 400.
  return fallbackTypes.length > 0
    ? `${url}?fallbackArtworkTypes=${fallbackTypes.join(',')}`
    : url;
};

export type NowPlayingSummary = {
  kind: TvGuideProgram['type'];

  // The show or artist for episodes and tracks, else the program's own title.
  // Unset for redirects, which name a channel instead.
  title?: string;

  // Episode or track title, with its code when known.
  detail?: string;

  // Short episode code such as "S01E03", for tight table cells.
  code?: string;
  redirectChannel?: number;

  // Fraction of the program already aired, from 0 to 1.
  progress: number;
  artworkUrl?: string;
};

const pad2 = (n: number) => padStart(String(n), 2, '0');

const describeProgram = (
  program: TerminalProgram,
): Pick<NowPlayingSummary, 'title' | 'detail' | 'code'> => {
  const grandparent = extractProgramGrandparent(program);
  if (program.type !== 'episode' && program.type !== 'track') {
    return { title: program.title };
  }

  const index =
    program.type === 'episode' ? program.episodeNumber : program.trackNumber;
  const parentIndex =
    program.type === 'episode' ? program.season?.index : program.album?.index;
  const code =
    program.type === 'episode' && !isNil(index) && !isNil(parentIndex)
      ? `S${pad2(parentIndex)}E${pad2(index)}`
      : undefined;

  if (!grandparent) {
    return { title: program.title, code };
  }

  return {
    title: grandparent.title,
    detail: code ? `${code} · ${program.title}` : program.title,
    code,
  };
};

export const summarizeNowPlaying = (
  program: TvGuideProgram,
  now: number,
  backendUri: string,
): NowPlayingSummary => {
  const length = program.stop - program.start;
  const progress = length > 0 ? clamp((now - program.start) / length, 0, 1) : 0;

  return match(program)
    .returnType<NowPlayingSummary>()
    .with({ type: 'content' }, (p) => ({
      kind: p.type,
      progress,
      ...describeProgram(p.program),
      artworkUrl: programArtworkUrl(backendUri, p.program),
    }))
    .with({ type: 'custom' }, (p) => {
      const inner = p.program?.program;
      return {
        kind: p.type,
        progress,
        ...(inner ? describeProgram(inner) : {}),
        artworkUrl: inner ? programArtworkUrl(backendUri, inner) : undefined,
      };
    })
    .with({ type: 'flex' }, (p) => ({ kind: p.type, progress, title: p.title }))
    .with({ type: 'redirect' }, (p) => ({
      kind: p.type,
      progress,
      redirectChannel: p.channelNumber,
    }))
    .exhaustive();
};

// The program each channel airs at `at`, keyed by channel id. Falls back to a
// lineup's first program when none spans `at`.
export const currentPrograms = (
  lineups: readonly Pick<ChannelLineup, 'id' | 'programs'>[],
  at: number,
): Map<string, TvGuideProgram> => {
  const programs = new Map<string, TvGuideProgram>();
  for (const lineup of lineups) {
    const program =
      lineup.programs.find((p) => p.start <= at && p.stop > at) ??
      lineup.programs[0];
    if (program) {
      programs.set(lineup.id, program);
    }
  }
  return programs;
};

export const failedGuideRetryMs = 60_000;

// Milliseconds until the guide should be refetched. That is just after the
// first current program ends, or a fixed delay after a failed fetch.
// Undefined means no refetch is due.
export const guideRefreshDelay = (
  stops: readonly number[],
  now: number,
  failed: boolean,
): number | undefined => {
  if (failed) {
    return failedGuideRetryMs;
  }
  if (stops.length === 0) {
    return;
  }
  return Math.max(Math.min(...stops) - now, 0) + 1_000;
};

export type ChannelStatus = {
  // 'warning' means sessions are open but nobody is connected.
  status: 'live' | 'warning' | 'idle';
  connections: number;
  sessions: number;
};

export const channelStatus = (
  sessions: ChannelSession[] | undefined,
): ChannelStatus => {
  const count = sessions?.length ?? 0;
  const connections = sumBy(sessions, (s) => s.numConnections);
  if (count === 0) {
    return { status: 'idle', connections: 0, sessions: 0 };
  }
  return {
    status: connections > 0 ? 'live' : 'warning',
    connections,
    sessions: count,
  };
};

export const streamModeLabel = (mode: Channel['streamMode']) =>
  mode.replaceAll('_', ' ').toUpperCase();

export type ChannelStatusFilter = 'all' | 'streaming' | 'stealth';

// "Streaming" means someone is watching, the same rule as the page's
// streaming count.
export const matchesStatusFilter = (
  channel: Pick<Channel, 'sessions' | 'stealth'>,
  filter: ChannelStatusFilter,
) => {
  switch (filter) {
    case 'all':
      return true;
    case 'streaming':
      return channelStatus(channel.sessions).status === 'live';
    case 'stealth':
      return channel.stealth;
  }
};

// Asks the server to send the playlist at `m3uUrl` as an attachment, since
// browsers ignore the `download` attribute on cross-origin links. With
// `numbers`, limits the playlist to those channels.
export const channelsM3uUrl = (m3uUrl: string, numbers?: readonly number[]) => {
  const url = new URL(m3uUrl, window.location.origin);
  if (numbers) {
    url.searchParams.set(
      'channels',
      [...numbers].sort((a, b) => a - b).join(','),
    );
  }
  url.searchParams.set('download', 'true');
  return url.toString();
};
