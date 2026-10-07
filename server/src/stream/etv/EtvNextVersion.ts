import serverPackage from '../../../package.json' with { type: 'json' };

/**
 * The version the pinned worker reports, without build metadata. A develop pin
 * reports `0.2.0-96aa6cb6-develop`, and a tag pin reports `0.2.0`.
 */
export const pinnedEtvNextVersion =
  serverPackage.ersatztvNext.releaseTag.replace(/^v/, '');

/**
 * Reads the version out of `ersatztv-channel 0.2.0-96aa6cb6-develop+linux-x64`.
 *
 * The whole token is kept. Upstream's develop builds carry the commit as a
 * prerelease suffix, so the bare semver of a tag and of every develop build
 * after it are the same.
 */
export function parseEtvNextVersion(output: string): string | undefined {
  return /\d+\.\d+\.\d+\S*/.exec(output)?.[0];
}

/**
 * Upstream appends the build target as semver build metadata (`+linux-x64`,
 * or `+local` for a source build). Build metadata does not identify a release,
 * so the comparison drops it.
 */
export function matchesPinnedEtvNextVersion(version: string): boolean {
  return version.replace(/\+.*$/, '') === pinnedEtvNextVersion;
}
