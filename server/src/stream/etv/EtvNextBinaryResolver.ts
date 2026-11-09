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
import { findContractMismatches, parseDescribe } from './EtvNextDescribe.ts';
import {
  matchesPinnedEtvNextVersion,
  parseEtvNextVersion,
  pinnedEtvNextVersion,
} from './EtvNextVersion.ts';
import type { Describe } from './generated/describe.ts';

export const ETV_NEXT_BINARY_NAME = 'ersatztv-channel';

const ProbeTimeoutMs = 10_000;

export class EtvNextBinaryNotFoundError extends Error {
  constructor(readonly testedPaths: string[]) {
    super(
      `Could not find the ${ETV_NEXT_BINARY_NAME} binary at any of the tested paths: ${testedPaths.join(', ')}. In a source checkout, run \`pnpm download-ersatztv-next\` in server/ to fetch it.`,
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

export class EtvNextContractMismatchError extends Error {
  constructor(
    readonly executablePath: string,
    readonly mismatches: string[],
  ) {
    super(
      `The ${ETV_NEXT_BINARY_NAME} binary at ${executablePath} cannot run Tunarr's channels: ${mismatches.join('; ')}.`,
    );
    this.name = 'EtvNextContractMismatchError';
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
  #checked: string | undefined;
  #installedVersion: string | undefined;

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

  /**
   * Runs `ersatztv-channel describe`. Returns undefined when the worker
   * predates the command (before 0.2.5) or prints output Tunarr cannot read.
   */
  async describe(): Promise<Describe | undefined> {
    const executablePath = await this.resolve();
    try {
      // Bounded, because every session start runs this under its channel lock.
      const stdout = await this.childProcessHelper.getStdout(
        executablePath,
        ['describe'],
        { timeout: ProbeTimeoutMs, isPath: true },
      );
      return parseDescribe(stdout);
    } catch (e) {
      this.logger.debug(
        e,
        'Could not read `%s describe` output',
        ETV_NEXT_BINARY_NAME,
      );
      return;
    }
  }

  /** Reads the worker's own version string, e.g. `0.2.5+linux-x64`. */
  async getVersion(): Promise<string | undefined> {
    return this.versionOf(await this.describe());
  }

  /** The version `describe` reports, or the `--version` probe when it reports none. */
  private async versionOf(
    described: Describe | undefined,
  ): Promise<string | undefined> {
    const version = described?.binary.version;
    return isNonEmptyString(version) ? version : await this.readVersionFlag();
  }

  /** The `--version` probe, for workers that predate `describe`. */
  private async readVersionFlag(): Promise<string | undefined> {
    const executablePath = await this.resolve();
    const stdout = await this.childProcessHelper.getStdout(
      executablePath,
      ['--version'],
      { timeout: ProbeTimeoutMs, isPath: true },
    );

    return parseEtvNextVersion(stdout);
  }

  /**
   * The installed worker's version for display, or undefined when the binary
   * is missing or its version cannot be read. Only a readable version is
   * cached, so a binary installed later still shows up.
   */
  async getInstalledVersion(): Promise<string | undefined> {
    if (this.#installedVersion) {
      return this.#installedVersion;
    }

    try {
      this.#installedVersion = await this.getVersion();
    } catch (e) {
      if (!(e instanceof EtvNextBinaryNotFoundError)) {
        this.logger.debug(
          e,
          'Could not read the %s version',
          ETV_NEXT_BINARY_NAME,
        );
      }
    }

    return this.#installedVersion;
  }

  /**
   * Resolves the binary and checks it against the pin and Tunarr's contract.
   *
   * A bundled binary that differs from the pin, or whose version cannot be
   * read, is refused, because Tunarr's schemas describe only the pinned
   * release. A binary found through `TUNARR_ERSATZTV_NEXT_PATH` only warns
   * about its version, so developers can run a local build.
   *
   * Any binary whose `describe` contract differs from what Tunarr writes and
   * reads is refused, wherever it came from, because its channels cannot
   * stream. A binary from the env var that has no `describe` runs unchecked.
   *
   * @throws EtvNextVersionMismatchError for a bundled binary off the pin.
   * @throws EtvNextContractMismatchError for a contract Tunarr cannot use.
   */
  async resolveChecked(): Promise<string> {
    if (this.#checked !== undefined) {
      return this.#checked;
    }

    const executablePath = await this.resolve();
    const described = await this.describe();
    const version = await this.versionOf(described);
    const fromEnv =
      EtvNextBinaryResolver.envCandidatePaths().includes(executablePath);

    if (!isNonEmptyString(version) || !matchesPinnedEtvNextVersion(version)) {
      if (!fromEnv) {
        throw new EtvNextVersionMismatchError(executablePath, version);
      }

      this.logger.warn(
        'The ErsatzTV next worker at %s reports %s, but Tunarr pinned %s. Running it because TUNARR_ERSATZTV_NEXT_PATH points at it. Streams may fail in ways the schema cannot catch.',
        executablePath,
        version ?? 'no readable version',
        pinnedEtvNextVersion,
      );
    }

    if (described) {
      const mismatches = findContractMismatches(described);
      if (mismatches.length > 0) {
        throw new EtvNextContractMismatchError(executablePath, mismatches);
      }
    } else if (fromEnv) {
      this.logger.warn(
        'The ErsatzTV next worker at %s does not answer `describe`, so Tunarr cannot check its contract. Running it because TUNARR_ERSATZTV_NEXT_PATH points at it.',
        executablePath,
      );
    } else {
      throw new EtvNextContractMismatchError(executablePath, [
        '`describe` failed or printed output Tunarr cannot read',
      ]);
    }

    this.#checked = executablePath;
    return executablePath;
  }
}
