import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { describe, expect, test, vi } from 'vitest';
import { killOrphanedProcess } from './killOrphanedProcess.ts';
import type { Logger } from './logging/LoggerFactory.ts';

const logger = {
  info: vi.fn(),
  warn: vi.fn(),
} as unknown as Logger;

describe('killOrphanedProcess', () => {
  test('kills a process whose name matches', async () => {
    const child = spawn('sleep', ['30']);
    const exited = once(child, 'exit');
    const pid = child.pid;
    if (pid === undefined) {
      throw new Error('sleep did not start');
    }

    await killOrphanedProcess(pid, (name) => name.startsWith('sleep'), logger);

    await expect(exited).resolves.toBeDefined();
  });

  test('leaves a process alone when its name does not match', async () => {
    const child = spawn('sleep', ['30']);
    const pid = child.pid;
    if (pid === undefined) {
      throw new Error('sleep did not start');
    }

    try {
      await killOrphanedProcess(
        pid,
        (name) => name.startsWith('ersatztv-channel'),
        logger,
      );

      expect(child.exitCode).toBeNull();
      expect(child.signalCode).toBeNull();
    } finally {
      child.kill('SIGKILL');
    }
  });
});
