import { getTunarrVersion } from '@/util/version.js';

export type PlexTimelineReport = {
  ratingKey: string;
  playState: 'playing' | 'stopped';
  startTime: number;
  duration: number;
  sessionId: string;
};

const StaticPlexHeaders = {
  'X-Plex-Product': 'Tunarr',
  'X-Plex-Platform': 'Generic',
  'X-Plex-Client-Platform': 'Generic',
  'X-Plex-Client-Profile-Name': 'Generic',
  'X-Plex-Device': 'Tunarr',
  'X-Plex-Device-Name': 'Tunarr',
};

/**
 * Plex registers one device per client identifier, so the identifier is the
 * install's persisted ID. The session identifier tells concurrent playbacks
 * apart. Without it, Plex merges every timeline from the client into one
 * Now Playing entry.
 */
export function buildPlexTimelineParams(
  report: PlexTimelineReport,
  clientIdentifier: string,
) {
  return {
    ...StaticPlexHeaders,
    ratingKey: report.ratingKey,
    state: report.playState,
    key: `/library/metadata/${report.ratingKey}`,
    time: report.startTime,
    duration: report.duration,
    'X-Plex-Version': getTunarrVersion(),
    'X-Plex-Client-Identifier': clientIdentifier,
    'X-Plex-Session-Identifier': report.sessionId,
  };
}
