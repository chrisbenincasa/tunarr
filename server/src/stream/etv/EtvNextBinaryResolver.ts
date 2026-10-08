import { inject, injectable } from 'inversify';
import { compact } from 'lodash-es';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ChildProcessHelper } from '../../util/ChildProcessHelper.ts';
import { TUNARR_ENV_VARS, getEnvVar } from '../../util/env.ts';
import { isNonEmptyString } from '../../util/index.ts';
import { InjectLogger } from '../../util/inject.ts';
import type { Logger } from '../../util/logging/LoggerFactory.ts';
import {
  matchesPinnedEtvNextVersion,
  parseEtvNextVersion,
  pinnedEtvNextVersion,
} from './EtvNextVersion.ts';

export const ETV_NEXT_BINARY_NAME = 'ersatztv-channel';

export class EtvNextBinaryNotFoundError extends Error {
  constructor(readonly testedPaths: string[]) {
    super(
      `Could not find the ${ETV_NEXT_BINARY_NAME} binary at any of the tested paths: ${testedPaths.join(', ')}`,
    );
    this.name = 'EtvNextBinaryNotFoundError';
  }
}

export class EtvNextVersionMismatchError extends Error {
  constructor(
    readonly executablePath: string,
    readonly version: string | undefined,
  ) {
    super(
      `The ${ETV_NEXT_BINARY_NAME} binary at ${executablePath} reports ${version ?? 'no readable version'}, but this Tunarr build requires ${pinnedEtvNextVersion}. Reinstall Tunarr, or set TUNARR_ERSATZTV_NEXT_PATH to run a different build at your own risk.`,
    );
    this.name = 'EtvNextVersionMismatchError';
  }
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
    const envPath = getEnvVar(TUNARR_ENV_VARS.ERSATZTV_NEXT_PATH);

    return compact(
      EtvNextBinaryResolver.binaryNames(platform, arch).flatMap(
        (binaryName) => [
          envPath,
          isNonEmptyString(envPath) ? path.join(envPath, binaryName) : null,
          path.join(process.cwd(), 'bin', binaryName),
          path.join(process.cwd(), binaryName),
        ],
      ),
    );
  }

  /** The candidates that come from `TUNARR_ERSATZTV_NEXT_PATH`, if it is set. */
  static envCandidatePaths(
    platform: string = os.platform(),
    arch: string = os.arch(),
  ): string[] {
    const envPath = getEnvVar(TUNARR_ENV_VARS.ERSATZTV_NEXT_PATH);
    if (!isNonEmptyString(envPath)) {
      return [];
    }

    return [
      envPath,
      ...EtvNextBinaryResolver.binaryNames(platform, arch).map((binaryName) =>
        path.join(envPath, binaryName),
      ),
    ];
  }

  private static binaryNames(platform: string, arch: string): string[] {
    return [
      `${ETV_NEXT_BINARY_NAME}-${platform}-${arch}`,
      ETV_NEXT_BINARY_NAME,
    ].map((n) => (platform === 'win32' ? `${n}.exe` : n));
  }

  /**
   * Resolves the binary path, caching the result.
   *
   * @throws EtvNextBinaryNotFoundError when nothing is found. Callers surface
   * this as "the backend is not installed" rather than retrying.
   */
  async resolve(): Promise<string> {
    if (this.#resolved) {
      return this.#resolved;
    }

    const testPaths = EtvNextBinaryResolver.candidatePaths();
    for (const testPath of testPaths) {
      // The env var may name a directory, which exists but is not the binary.
      const isFile = await fs
        .stat(testPath)
        .then((stats) => stats.isFile())
        .catch(() => false);
      if (isFile) {
        this.logger.debug('Found %s at %s', ETV_NEXT_BINARY_NAME, testPath);
        this.#resolved = testPath;
        return testPath;
      }
    }

    throw new EtvNextBinaryNotFoundError(testPaths);
  }

  /** Reads the worker's own version string, e.g. `0.2.0-96aa6cb6-develop+linux-x64`. */
  async getVersion(): Promise<string | undefined> {
    const executablePath = await this.resolve();
    const stdout = await this.childProcessHelper.getStdout(executablePath, [
      '--version',
    ]);

    return parseEtvNextVersion(stdout);
  }

  /**
   * Resolves the binary and checks its version against the pin.
   *
   * A bundled binary that differs from the pin, or whose version cannot be
   * read, is refused, because Tunarr's schemas describe only the pinned
   * release. A binary found through `TUNARR_ERSATZTV_NEXT_PATH` only warns,
   * so developers can run a local build.
   *
   * @throws EtvNextVersionMismatchError for a bundled binary off the pin.
   */
  async resolveChecked(): Promise<string> {
    const executablePath = await this.resolve();
    const version = await this.getVersion();

    if (version && matchesPinnedEtvNextVersion(version)) {
      return executablePath;
    }

    const fromEnv =
      EtvNextBinaryResolver.envCandidatePaths().includes(executablePath);
    if (!fromEnv) {
      throw new EtvNextVersionMismatchError(executablePath, version);
    }

    this.logger.warn(
      'The ErsatzTV next worker at %s reports %s, but Tunarr pinned %s. Running it because TUNARR_ERSATZTV_NEXT_PATH points at it. Streams may fail in ways the schema cannot catch.',
      executablePath,
      version ?? 'no readable version',
      pinnedEtvNextVersion,
    );
    return executablePath;
  }
}
