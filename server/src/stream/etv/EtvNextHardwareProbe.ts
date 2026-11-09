import { inject, injectable } from 'inversify';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ChildProcessHelper } from '../../util/ChildProcessHelper.ts';
import { InjectLogger } from '../../util/inject.ts';
import type { Logger } from '../../util/logging/LoggerFactory.ts';
import { EtvNextBinaryResolver } from './EtvNextBinaryResolver.ts';
import type { HardwareSelection } from './EtvNextChannelConfigMapper.ts';
import { parseDescribe } from './EtvNextDescribe.ts';
import { probeOverlay } from './EtvNextHardwareCheck.ts';
import type { RuntimeCapability } from './generated/describe.ts';

/** A probe tries every device and driver, which takes seconds. */
const ProbeTimeoutMs = 60_000;

/** Hardware rarely changes, and the settings page asks on every render. */
export const ProbeCacheTtlMs = 10 * 60_000;

type CacheEntry = {
  expiresAt: number;
  result: Promise<RuntimeCapability | undefined>;
};

/**
 * Runs `ersatztv-channel describe --probe` to learn what this machine can
 * encode in hardware.
 */
@injectable()
export class EtvNextHardwareProbe {
  @InjectLogger() declare private readonly logger: Logger;

  #cache = new Map<string, CacheEntry>();

  constructor(
    @inject(EtvNextBinaryResolver)
    private binaryResolver: EtvNextBinaryResolver,
    @inject(ChildProcessHelper)
    private childProcessHelper: ChildProcessHelper,
  ) {}

  /**
   * Probes with the selection's accel, device and driver marked as configured.
   * Results are cached per selection and ffmpeg path, and concurrent callers
   * share one probe. Returns undefined when the probe cannot run, and does not
   * cache that.
   */
  probe(
    selection: HardwareSelection,
    ffmpegPath: string,
    now: number = Date.now(),
  ): Promise<RuntimeCapability | undefined> {
    const key = JSON.stringify([selection, ffmpegPath]);
    const cached = this.#cache.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.result;
    }

    const result = this.run(selection, ffmpegPath).then((runtime) => {
      if (!runtime) {
        this.#cache.delete(key);
      }
      return runtime;
    });
    this.#cache.set(key, { expiresAt: now + ProbeCacheTtlMs, result });
    return result;
  }

  private async run(
    selection: HardwareSelection,
    ffmpegPath: string,
  ): Promise<RuntimeCapability | undefined> {
    let dir: string | undefined;
    try {
      const executablePath = await this.binaryResolver.resolveChecked();
      dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tunarr-etv-probe-'));
      const overlayPath = path.join(dir, 'channel.json');
      await fs.writeFile(overlayPath, JSON.stringify(probeOverlay(selection)));

      const stdout = await this.childProcessHelper.getStdout(
        executablePath,
        ['describe', '--ffmpeg', ffmpegPath, '--probe', overlayPath],
        { timeout: ProbeTimeoutMs, isPath: true },
      );

      const runtime = parseDescribe(stdout).runtime_capability;
      if (!runtime) {
        this.logger.warn(
          'The ErsatzTV next hardware probe returned no runtime capability',
        );
        return;
      }
      return runtime;
    } catch (e) {
      this.logger.warn(e, 'The ErsatzTV next hardware probe failed');
      return;
    } finally {
      if (dir) {
        await fs.rm(dir, { recursive: true, force: true });
      }
    }
  }
}
