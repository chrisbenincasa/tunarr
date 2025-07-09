import { TruthyQueryParam } from '../types/schemas.ts';
import type { Nullable } from '../types/util.ts';
import { isNonEmptyString, parseIntOrNull } from './index.ts';

export const DATABASE_LOCATION_ENV_VAR = 'TUNARR_DATABASE_PATH';
export const SERVER_PORT_ENV_VAR = 'TUNARR_SERVER_PORT';
export const ADMIN_MODE_ENV_VAR = 'TUNARR_SERVER_ADMIN_MODE';
export const PRINT_ROUTES_ENV_VAR = 'TUNARR_SERVER_PRINT_ROUTES';
export const TRUST_PROXY_ENV_VAR = 'TUNARR_SERVER_TRUST_PROXY';
export const BIND_ADDR_ENV_VAR = 'TUNARR_BIND_ADDR';
export const BUILD_ENV_VAR = 'TUNARR_BUILD';
export const BASE_IMAGE_TAG_ENV_VAR = 'TUNARR_BUILD_BASE_TAG';
export const IS_EDGE_BUILD_ENV_VAR = 'TUNARR_EDGE_BUILD';
export const USE_WORKER_POOL_ENV_VAR = 'TUNARR_USE_WORKER_POOL';
export const WORKER_POOL_SIZE_ENV_VAR = 'TUNARR_WORKER_POOL_SIZE';

// Debug vars
export const DEBUG__PROGRAM_GROUPING_UPDATE_CHUNK_SIZE =
  'TUNARR_DEBUG_PROGRAM_GROUP_CHUNK_SIZE';

export const TUNARR_ENV_VARS = {
  DATABASE_LOCATION_ENV_VAR,
  SERVER_PORT_ENV_VAR,
  ADMIN_MODE_ENV_VAR,
  PRINT_ROUTES_ENV_VAR,
  TRUST_PROXY_ENV_VAR,
  BIND_ADDR_ENV_VAR,
  BUILD_ENV_VAR,
  IS_EDGE_BUILD_ENV_VAR,
  BASE_IMAGE_TAG_ENV_VAR,
  WORKER_POOL_SIZE_ENV_VAR,
  DEBUG__PROGRAM_GROUPING_UPDATE_CHUNK_SIZE,
} as const;

type ValidEnvVar = (typeof TUNARR_ENV_VARS)[keyof typeof TUNARR_ENV_VARS];

export function getEnvVar(name: ValidEnvVar): Nullable<string> {
  const val = process.env[name];
  return isNonEmptyString(val) ? val : null;
}

export const getNumericEnvVar = (name: ValidEnvVar) => {
  const strValue = getEnvVar(name);
  return strValue ? parseIntOrNull(strValue) : null;
};

export const getBooleanEnvVar = (
  name: ValidEnvVar,
  defaultValue: boolean = true,
) => {
  const strValue = getEnvVar(name);
  if (strValue) {
    return TruthyQueryParam.catch(defaultValue).parse(process.env[name]);
  }
  return defaultValue;
};
