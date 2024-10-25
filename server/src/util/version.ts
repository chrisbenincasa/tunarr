import { createRequire } from 'module';
import { isNonEmptyString } from './index.js';
const require = createRequire(import.meta.url);

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
    const isEdge = process.env['TUNARR_EDGE_BUILD'] === 'true';
    const tunarrBuild = process.env['TUNARR_BUILD'];

    // Attempt to set for dev. This is relative to the shared package
    tunarrVersion = loadPackageVersion('../../package.json') ?? '';

    // Attempt to set in prod. This is the root package.json that gets copied
    // over at build time. In theory, it has the same value as the shared/package.json
    // always.
    if (tunarrVersion === '') {
      tunarrVersion = loadPackageVersion('./package.json') ?? '';
    }

    if (isNonEmptyString(tunarrBuild) && isEdge) {
      tunarrVersion += `-${tunarrBuild}`;
    }

    if (tunarrVersion === '') {
      tunarrVersion = 'unknown';
    }
  }

  return tunarrVersion;
};
