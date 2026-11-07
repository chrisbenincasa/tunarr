import type { ISettingsDB } from '@/db/interfaces/ISettingsDB.js';
import { setTestGlobalOptions } from '@/testing/getFakeSettingsDb.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import tmp from 'tmp';
import { beforeAll, describe, expect, test } from 'vitest';
import {
  GetSegmentStreamEndsTask,
  parseSegmentStreamEnds,
} from './GetSegmentStreamEnds.js';

describe('parseSegmentStreamEnds', () => {
  test('tracks audio and video ends separately when video is the last packet written', () => {
    // From a real HLS segment: the muxer writes video last, but audio ends
    // 360 ticks (4 ms) later.
    const lines = [
      'audio|1079521|1920|',
      'video|1074001|3000',
      'audio|1081441|1920|',
      'video|1077001|3000',
      'video|1080001|3000',
    ];

    expect(parseSegmentStreamEnds(lines)).toEqual({
      audioEnd: 1083361,
      nonAudioEnd: 1083001,
    });
  });

  test('uses the latest end rather than the last packet of a stream', () => {
    // B-frames put packets out of presentation order.
    const lines = ['video|9000|3000', 'video|3000|3000'];

    expect(parseSegmentStreamEnds(lines)).toEqual({ nonAudioEnd: 12000 });
  });

  test('skips packets without a PTS', () => {
    const lines = ['video|6000|3000', 'video|N/A|3000', 'audio|N/A|1920'];

    expect(parseSegmentStreamEnds(lines)).toEqual({ nonAudioEnd: 9000 });
  });

  test('pads packets without a duration', () => {
    expect(parseSegmentStreamEnds(['audio|5000|N/A'])).toEqual({
      audioEnd: 15000,
    });
  });

  test('throws when no packet has a PTS', () => {
    expect(() => parseSegmentStreamEnds(['video|N/A|3000'])).toThrow(
      /No packet with a PTS found/,
    );
    expect(() => parseSegmentStreamEnds([])).toThrow(
      /No packet with a PTS found/,
    );
  });
});

describe('GetSegmentStreamEndsTask', () => {
  beforeAll(async () => {
    await setTestGlobalOptions();
  });

  async function runWithFakeFfprobe(exitCode: number) {
    const dir = tmp.dirSync({ unsafeCleanup: true });
    try {
      const ffprobePath = path.join(dir.name, 'ffprobe');
      await fs.writeFile(
        ffprobePath,
        `#!/bin/sh\necho 'video|90000|3000'\nexit ${exitCode}\n`,
        { mode: 0o755 },
      );
      const settingsDB = { ffprobePath } as unknown as ISettingsDB;
      return await new GetSegmentStreamEndsTask(settingsDB).run(
        '/test/segment.ts',
      );
    } finally {
      dir.removeCallback();
    }
  }

  test.skipIf(process.platform === 'win32')(
    'parses the packets of a successful probe',
    async () => {
      const result = await runWithFakeFfprobe(0);

      expect(result.get()).toEqual({ nonAudioEnd: 93000 });
    },
  );

  // A failed probe can leave partial output, which must not pass as a
  // measurement.
  test.skipIf(process.platform === 'win32')(
    'fails when ffprobe exits nonzero, even with parseable output',
    async () => {
      const result = await runWithFakeFfprobe(1);

      expect(result.isFailure()).toBe(true);
    },
  );

  test('fails with a clear error when ffprobe does not exist', async () => {
    const settingsDB = {
      ffprobePath: '/nonexistent/ffprobe',
    } as unknown as ISettingsDB;

    const result = await new GetSegmentStreamEndsTask(settingsDB).run(
      '/test/segment.ts',
    );

    expect(result.isFailure()).toBe(true);
    if (result.isFailure()) {
      expect(result.error.cause?.message).toContain('does not exist');
    }
  });
});
