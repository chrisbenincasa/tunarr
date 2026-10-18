import retry from 'async-retry';
import findProcessModule from 'find-process';
import fs from 'node:fs/promises';
import type { Logger } from './logging/LoggerFactory.ts';

type FindProcess = typeof findProcessModule.default;

// Node's ESM loader hands back the CommonJS exports object, so the function
// sits on `.default`. Vitest unwraps that level itself.
const findProcess: FindProcess =
  typeof findProcessModule === 'function'
    ? (findProcessModule as FindProcess)
    : findProcessModule.default;

/** Reads a pid file, or returns undefined when it is missing or malformed. */
export async function readPidFile(pidFilePath: string) {
  try {
    const pid = Number.parseInt(
      (await fs.readFile(pidFilePath, 'utf-8')).trim(),
      10,
    );
    return Number.isSafeInteger(pid) && pid > 0 ? pid : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Kills `pid` left by a previous run, but only after confirming its process
 * name matches. Pids are recycled, and killing an unrelated process is worse
 * than leaving an orphan alive. Sends SIGTERM, then SIGKILL if the process is
 * still there a few seconds later.
 */
export async function killOrphanedProcess(
  pid: number,
  matchesName: (name: string) => boolean,
  logger: Logger,
) {
  const found = await findProcess('pid', pid);
  const proc = found[0];
  if (proc === undefined || !matchesName(proc.name)) {
    return;
  }

  logger.info('Killing orphaned %s process %d', proc.name, pid);

  try {
    process.kill(pid);
  } catch (e) {
    logger.warn(e, 'Could not signal orphaned process %d', pid);
    return;
  }

  try {
    await retry(
      async () => {
        if ((await findProcess('pid', pid)).length > 0) {
          throw new Error(`Process ${pid} has not exited`);
        }
      },
      { retries: 5, minTimeout: 200 },
    );
  } catch {
    logger.warn('Orphaned process %d ignored SIGTERM. Sending SIGKILL', pid);
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // It exited between the check and the signal.
    }
  }
}
