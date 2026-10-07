import { inject, injectable } from 'inversify';
import { compact } from 'lodash-es';
import os from 'node:os';
import path from 'node:path';
import { ChildProcessHelper } from '../../util/ChildProcessHelper.ts';
import { TUNARR_ENV_VARS, getEnvVar } from '../../util/env.ts';
import { fileExists } from '../../util/fsUtil.ts';
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
    if (this.#resolved) {
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

  /** Reads the worker's own version string, e.g. `0.2.0-96aa6cb6-develop+linux-x64`. */
  async getVersion(): Promise<string | undefined> {
    const executablePath = await this.resolve();
    const stdout = await this.childProcessHelper.getStdout(executablePath, [
      '--version',
    ]);

    return parseEtvNextVersion(stdout);
  }

  /**
   * Resolves the binary and warns when its version differs from the pin.
   *
   * A mismatch is logged rather than refused. Upstream publishes no tagged
   * release, so the only artifact available is a rolling one, and refusing to
   * start on drift would make the feature unusable rather than safe.
   */
  async resolveChecked(): Promise<string> {
    const executablePath = await this.resolve();
    const version = await this.getVersion();

    if (!version) {
      this.logger.warn(
        'Could not read a version from %s. Continuing, but the worker may not match the schemas Tunarr pinned at %s.',
        executablePath,
        pinnedEtvNextVersion,
      );
      return executablePath;
    }

    if (!matchesPinnedEtvNextVersion(version)) {
      this.logger.warn(
        'The ErsatzTV next worker at %s reports %s, but Tunarr pinned %s. Streams may fail in ways the schema cannot catch.',
        executablePath,
        version,
        pinnedEtvNextVersion,
      );
    }

    return executablePath;
  }
}
