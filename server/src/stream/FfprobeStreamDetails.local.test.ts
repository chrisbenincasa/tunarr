import fs from 'node:fs/promises';
import path from 'node:path';
import { FfmpegInfo } from '@/ffmpeg/ffmpegInfo.js';
import {
  createTempWorkdir,
  probeFile,
  runFfmpegWithPipeline,
} from '@/testing/ffmpeg/FfmpegIntegrationHelper.ts';
import { binaries, Fixtures } from '@/testing/ffmpeg/FfmpegTestFixtures.ts';
import { beforeAll, afterAll, describe, expect, test } from 'vitest';
import { FfprobeStreamDetails } from './FfprobeStreamDetails.ts';

// https://github.com/chrisbenincasa/tunarr/issues/2242
//
// Both files are built with the real ffmpeg and read back through the real
// ffprobe, so the stream shapes the mapping sees are the ones a scan sees.

describe.skipIf(!binaries)('FfprobeStreamDetails attached pictures', () => {
  let workdir: string;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    ({ dir: workdir, cleanup } = await createTempWorkdir());
  });

  afterAll(() => cleanup());

  function ffmpeg(args: string[]) {
    const { exitCode, stderr } = runFfmpegWithPipeline(binaries!.ffmpeg, args);
    expect(exitCode, `ffmpeg failed: ${stderr}`).toBe(0);
  }

  function makeSubject() {
    // Instantiated directly, ignoring Inversify DI bindings
    return new FfprobeStreamDetails(
      new FfmpegInfo(binaries!.ffmpeg, binaries!.ffprobe),
    );
  }

  test('a track with embedded cover art has no video stream', async () => {
    const cover = path.join(workdir, 'cover.jpg');
    const track = path.join(workdir, 'tagged.mp3');

    ffmpeg([
      '-f',
      'lavfi',
      '-i',
      'color=c=red:s=300x300',
      '-frames:v',
      '1',
      '-y',
      cover,
    ]);
    ffmpeg([
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=3',
      '-i',
      cover,
      '-map',
      '0:a',
      '-map',
      '1:v',
      '-c:a',
      'libmp3lame',
      '-c:v',
      'mjpeg',
      '-disposition:v:0',
      'attached_pic',
      '-id3v2_version',
      '3',
      '-y',
      track,
    ]);

    // Guard the fixture itself: a file that stopped carrying an attached
    // picture would make the assertion below pass for the wrong reason.
    const probed = probeFile(binaries!.ffprobe, track);
    const coverStream = probed.streams.find(
      (stream) =>
        stream.codec_type === 'video' && stream.disposition?.attached_pic === 1,
    );
    expect(coverStream, 'fixture has no attached picture stream').toBeDefined();

    const { streamDetails } = (
      await makeSubject().getStream({ path: track })
    ).getOrThrow();

    expect(streamDetails.videoDetails).toBeUndefined();
    expect(streamDetails.audioDetails).toHaveLength(1);
    expect(streamDetails.audioDetails?.[0]?.codec).toBe('mp3');
  });

  test('a video file with embedded cover art keeps its own video stream', async () => {
    const cover = path.join(workdir, 'cover.jpg');
    const video = path.join(workdir, 'tagged.mp4');

    ffmpeg([
      '-i',
      Fixtures.video720p,
      '-i',
      cover,
      '-map',
      '0:v',
      '-map',
      '0:a',
      '-map',
      '1:v',
      '-c',
      'copy',
      '-disposition:v:1',
      'attached_pic',
      '-y',
      video,
    ]);

    const { streamDetails } = (
      await makeSubject().getStream({ path: video })
    ).getOrThrow();

    expect(streamDetails.videoDetails).toHaveLength(1);
    expect(streamDetails.videoDetails?.[0]?.codec).toBe('h264');
    expect(streamDetails.videoDetails?.[0]?.width).toBe(1280);
    expect(streamDetails.videoDetails?.[0]?.isAttachedPic).toBe(false);
  });
});
