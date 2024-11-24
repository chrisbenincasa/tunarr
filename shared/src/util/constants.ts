const constants = {
  SLACK: 9999,
  TVGUIDE_MAXIMUM_PADDING_LENGTH_MS: 30 * 60 * 1000,
  DEFAULT_GUIDE_STEALTH_DURATION: 5 * 60 * 1000,
  TVGUIDE_MAXIMUM_FLEX_DURATION: 6 * 60 * 60 * 1000,
  TOO_FREQUENT: 100,
  DEFAULT_DATA_DIR: '.tunarr',
};

export const PlexClientIdentifier = 'p86cy1w47clco3ro8t92nfy1';

export const DefaultPlexHeaders = {
  Accept: 'application/json',
  'X-Plex-Device': 'Tunarr',
  'X-Plex-Device-Name': 'Tunarr',
  'X-Plex-Product': 'Tunarr',
  'X-Plex-Version': '0.1',
  'X-Plex-Client-Identifier': PlexClientIdentifier,
  'X-Plex-Platform': 'Chrome',
  'X-Plex-Platform-Version': '130.0',
};

export default constants;
