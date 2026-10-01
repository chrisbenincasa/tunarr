import serverPackage from '../../../package.json' with { type: 'json' };

/**
 * The version string the pinned worker prints. A `develop` pin prints
 * `0.1.0-570d136`, and a tag pin prints `0.2.0`.
 */
export const pinnedEtvNextVersion =
  serverPackage.ersatztvNext.assetVersion.replace(/^v/, '');

/**
 * Reads the version out of `ersatztv-channel 0.1.0-570d136`.
 *
 * The whole token is kept, suffix included. Upstream's `develop` builds append
 * the short SHA to the latest tag, so the bare semver of a tag and of every
 * later `develop` build are the same.
 */
export function parseEtvNextVersion(output: string): string | undefined {
  return /\d+\.\d+\.\d+\S*/.exec(output)?.[0];
}

export function matchesPinnedEtvNextVersion(version: string): boolean {
  return version === pinnedEtvNextVersion;
}
