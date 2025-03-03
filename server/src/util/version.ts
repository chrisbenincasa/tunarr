import tunarrPackage from '../../package.json' with { type: 'json' };
import {
  isEdgeBuild,
  isNonEmptyString,
  isProduction,
  tunarrBuild,
} from './index.js';

let tunarrVersion: string;
export const getTunarrVersion = () => {
  if (!tunarrVersion) {
    // Attempt to set for dev. This is relative to the shared package
    tunarrVersion = tunarrPackage.version ?? '';

    if (isNonEmptyString(tunarrBuild) && isEdgeBuild) {
      tunarrVersion += `-${tunarrBuild}`;
    }

    if (!isProduction) {
      tunarrVersion += '-dev';
    }

    if (tunarrVersion === '') {
      tunarrVersion = 'unknown';
    }
  }

  return tunarrVersion;
};
