import tunarrPackage from '../../package.json' with { type: 'json' };
import { isNonEmptyString } from './index.js';

let tunarrVersion: string;
export const getTunarrVersion = () => {
  if (!tunarrVersion) {
    const isEdge = process.env['TUNARR_EDGE_BUILD'] === 'true';
    const tunarrBuild = process.env['TUNARR_BUILD'];

    // Attempt to set for dev. This is relative to the shared package
    tunarrVersion = tunarrPackage.version ?? '';

    if (isNonEmptyString(tunarrBuild) && isEdge) {
      tunarrVersion += `-${tunarrBuild}`;
    }

    if (tunarrVersion === '') {
      tunarrVersion = 'unknown';
    }
  }

  return tunarrVersion;
};
