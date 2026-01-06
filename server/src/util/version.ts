import tunarrPackage from '../../package.json' with { type: 'json' };
import { getBooleanEnvVar, getEnvVar, TUNARR_ENV_VARS } from './env.ts';
import { isNonEmptyString, isProduction } from './index.js';

let tunarrVersion: string;
export const getTunarrVersion = () => {
  if (!tunarrVersion) {
    // Attempt to set for dev. This is relative to the shared package
    tunarrVersion =
      getEnvVar(TUNARR_ENV_VARS.BUILD_ENV_VAR) ?? tunarrPackage.version ?? '';

    const isEdgeBuild = getBooleanEnvVar(
      TUNARR_ENV_VARS.IS_EDGE_BUILD_ENV_VAR,
      false,
    );
    const tunarrBuild = getEnvVar(TUNARR_ENV_VARS.COMMIT_SHA_ENV_VAR);

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
