import tunarrPackage from '../../package.json' with { type: 'json' };
import { getEnvVar, TUNARR_ENV_VARS } from './env.ts';
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
    tunarrVersion =
      getEnvVar(TUNARR_ENV_VARS.BUILD_ENV_VAR) ?? tunarrPackage.version ?? '';

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
