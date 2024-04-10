const constants = {
  SLACK: 9999,
  TVGUIDE_MAXIMUM_PADDING_LENGTH_MS: 30 * 60 * 1000,
  DEFAULT_GUIDE_STEALTH_DURATION: 5 * 60 * 1000,
  TVGUIDE_MAXIMUM_FLEX_DURATION: 6 * 60 * 60 * 1000,
  TOO_FREQUENT: 100,

  VERSION_NAME: '0.1.0',

  DEFAULT_DATA_DIR: '.tunarr',
};

const PlexClientIdentifier = 'p86cy1w47clco3ro8t92nfy1';

export const DefaultPlexHeaders = {
  Accept: 'application/json',
  'X-Plex-Device': 'Tunarr',
  'X-Plex-Device-Name': 'Tunarr',
  'X-Plex-Product': 'Tunarr',
  'X-Plex-Version': '0.1',
  'X-Plex-Client-Identifier': PlexClientIdentifier,
  'X-Plex-Platform': 'Chrome',
  'X-Plex-Platform-Version': '80.0',
};

export default constants;
