import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const constants = {
  SLACK: 9999,
  TVGUIDE_MAXIMUM_PADDING_LENGTH_MS: 30 * 60 * 1000,
  DEFAULT_GUIDE_STEALTH_DURATION: 5 * 60 * 1000,
  TVGUIDE_MAXIMUM_FLEX_DURATION: 6 * 60 * 60 * 1000,
  TOO_FREQUENT: 100,
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

const loadPackageVersion = (path: string) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return require(path).version as string;
  } catch {
    return;
  }
};

let tunarrVersion: string;
export const getTunarrVersion = () => {
  if (!tunarrVersion) {
    // Attempt to set for dev. This is relative to the shared package
    tunarrVersion = loadPackageVersion('../../package.json') ?? '';

    // Attempt to set in prod. This is the root package.json that gets copied
    // over at build time. In theory, it has the same value as the shared/package.json
    // always.
    if (tunarrVersion === '') {
      tunarrVersion = loadPackageVersion('./package.json') ?? '';
    }

    if (tunarrVersion === '') {
      tunarrVersion = 'unknown';
    }
  }

  return tunarrVersion;
};

export default constants;
