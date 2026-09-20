import { inject, injectable } from 'inversify';
import { compact } from 'lodash-es';
import os from 'node:os';
import path from 'node:path';
import serverPackage from '../../../package.json' with { type: 'json' };
import { ChildProcessHelper } from '../../util/ChildProcessHelper.ts';
import { TUNARR_ENV_VARS, getEnvVar } from '../../util/env.ts';
import { fileExists } from '../../util/fsUtil.ts';
import { isNonEmptyString } from '../../util/index.ts';
import { InjectLogger } from '../../util/inject.ts';
import type { Logger } from '../../util/logging/LoggerFactory.ts';

export const ETV_NEXT_BINARY_NAME = 'ersatztv-channel';

export class EtvNextBinaryNotFoundError extends Error {
  constructor(readonly testedPaths: string[]) {
    super(
      `Could not find the ${ETV_NEXT_BINARY_NAME} binary at any of the tested paths: ${testedPaths.join(', ')}`,
    );
    this.name = 'EtvNextBinaryNotFoundError';
  }
}

/**
 * The commit the vendored schemas were generated from. The worker's version
 * string carries the same short SHA, which is what makes a mismatch detectable.
 */
export const pinnedCommit = serverPackage.ersatztvNext.commit;

export type EtvNextVersion = {
  raw: string;
  semver: string;
  commit: string | undefined;
};

/**
 * Parses `ersatztv-channel 0.1.0-ed95077`.
 *
 * Upstream builds the string from a tag plus a short SHA, so the commit half is
 * absent on a build made from a clean tag.
 */
export function parseVersion(output: string): EtvNextVersion | undefined {
  const raw = output.trim();
  const match = /(\d+\.\d+\.\d+)(?:-([0-9a-f]{7,40}))?/.exec(raw);
  const semver = match?.[1];
  if (semver === undefined) {
    return undefined;
  }

  return { raw, semver, commit: match?.[2] };
}

/** Whether a worker was built from the commit the vendored schemas came from. */
export function matchesPinnedCommit(version: EtvNextVersion): boolean {
  if (version.commit === undefined) {
    return false;
  }

  // Upstream abbreviates to 7 characters in the version string and the pin is
  // the full SHA, so compare on the shorter of the two.
  return pinnedCommit.startsWith(version.commit);
}

/**
 * Finds the `ersatztv-channel` worker binary.
 *
 * The search order mirrors `MeilisearchService` exactly, because `make-bin.ts`
 * lays both binaries down the same way — an arch-suffixed name beside the
 * server, and a bare name inside a release archive.
 */
@injectable()
export class EtvNextBinaryResolver {
  @InjectLogger() declare private readonly logger: Logger;

  #resolved: string | undefined;

  constructor(
    @inject(ChildProcessHelper)
    private childProcessHelper: ChildProcessHelper,
  ) {}

  /** Every path that would be tried, in order. Exposed so errors can name them. */
  static candidatePaths(
    platform: string = os.platform(),
    arch: string = os.arch(),
  ): string[] {
    const baseNames = [
      `${ETV_NEXT_BINARY_NAME}-${platform}-${arch}`,
      ETV_NEXT_BINARY_NAME,
    ];
    const binaryNames = baseNames.map((n) =>
      platform === 'win32' ? `${n}.exe` : n,
    );
    const envPath = getEnvVar(TUNARR_ENV_VARS.ERSATZTV_NEXT_PATH);

    return compact(
      binaryNames.flatMap((binaryName) => [
        envPath,
        isNonEmptyString(envPath) ? path.join(envPath, binaryName) : null,
        path.join(process.cwd(), 'bin', binaryName),
        path.join(process.cwd(), binaryName),
      ]),
    );
  }

  /**
   * Resolves the binary path, caching the result.
   *
   * @throws EtvNextBinaryNotFoundError when nothing is found. Callers surface
   * this as "the backend is not installed" rather than retrying.
   */
  async resolve(): Promise<string> {
    if (this.#resolved !== undefined) {
      return this.#resolved;
    }

    const testPaths = EtvNextBinaryResolver.candidatePaths();
    for (const testPath of testPaths) {
      if (await fileExists(testPath)) {
        this.logger.debug('Found %s at %s', ETV_NEXT_BINARY_NAME, testPath);
        this.#resolved = testPath;
        return testPath;
      }
    }

    throw new EtvNextBinaryNotFoundError(testPaths);
  }

  /** Reads the worker's own version string. */
  async getVersion(): Promise<EtvNextVersion | undefined> {
    const executablePath = await this.resolve();
    const stdout = await this.childProcessHelper.getStdout(executablePath, [
      '--version',
    ]);

    return parseVersion(stdout);
  }

  /**
   * Resolves the binary and warns when it was not built from the pinned commit.
   *
   * A mismatch is logged rather than refused. Upstream publishes no tagged
   * release, so the only artifact available is a rolling one, and refusing to
   * start on drift would make the feature unusable rather than safe.
   */
  async resolveChecked(): Promise<string> {
    const executablePath = await this.resolve();
    const version = await this.getVersion();

    if (version === undefined) {
      this.logger.warn(
        'Could not read a version from %s. Continuing, but the worker may not match the schemas Tunarr generated against commit %s.',
        executablePath,
        pinnedCommit.slice(0, 7),
      );
      return executablePath;
    }

    if (!matchesPinnedCommit(version)) {
      this.logger.warn(
        'The ErsatzTV next worker reports "%s" but Tunarr generated its schemas against commit %s. Streams may fail in ways the schema cannot catch.',
        version.raw,
        pinnedCommit.slice(0, 7),
      );
    }

    return executablePath;
  }
}
