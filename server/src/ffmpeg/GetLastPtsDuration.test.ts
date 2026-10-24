import type * as ChildProcessModule from 'node:child_process';
import { ChildProcess, spawn } from 'node:child_process';
import { PassThrough } from 'node:stream';
import { setImmediate } from 'node:timers/promises';
import { beforeAll, describe, expect, test, vi } from 'vitest';
import {
  getFakeSettingsDb,
  setTestGlobalOptions,
} from '../testing/getFakeSettingsDb.js';
import { GetLastPtsDurationTask } from './GetLastPtsDuration.js';

vi.mock('node:child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof ChildProcessModule>()),
  spawn: vi.fn(),
}));

beforeAll(async () => {
  await setTestGlobalOptions();
});

describe('HLS segment probe exit status', () => {
  test.each([0, 1])(
    'handles parseable output followed by exit %i',
    async (code) => {
      const child = new ChildProcess();
      const stdout = new PassThrough();
      child.stdout = stdout;
      vi.mocked(spawn).mockReturnValueOnce(child);

      const resultPromise = new GetLastPtsDurationTask(getFakeSettingsDb()).run(
        '/test/segment.ts',
      );
      stdout.end('90000|3000\n');
      await setImmediate();
      child.emit('close', code, null);
      const result = await resultPromise;

      if (code === 0) {
        expect(result.get()).toEqual({ pts: 90000, duration: 3000 });
      } else {
        expect(result.isFailure()).toBe(true);
        if (result.isFailure()) {
          expect(result.error.cause?.message).toContain(
            'ffprobe exited with code 1',
          );
        }
      }
    },
  );
});
