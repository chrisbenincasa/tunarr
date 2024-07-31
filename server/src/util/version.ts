import { createRequire } from 'module';
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
