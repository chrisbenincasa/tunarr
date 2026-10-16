import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { FileStreamSource, HttpStreamSource } from '../../../stream/types.ts';
import { createTempWorkdir } from '../../../testing/ffmpeg/FfmpegIntegrationHelper.ts';
import {
  binaries,
  ffmpegTest,
  Fixtures,
} from '../../../testing/ffmpeg/FfmpegTestFixtures.ts';
import type { FfmpegCapabilities } from '../capabilities/FfmpegCapabilities.ts';
import { FileOutputLocation } from '../constants.ts';
import { PixelFormatYuv420P } from '../format/PixelFormat.ts';
import { SubtitlesInputSource } from '../input/SubtitlesInputSource.ts';
import { VideoInputSource } from '../input/VideoInputSource.ts';
import {
  ExternalSubtitleStream,
  SubtitleMethods,
  VideoStream,
} from '../MediaStream.ts';
import { SoftwarePipelineBuilder } from '../pipeline/software/SoftwarePipelineBuilder.ts';
import { DefaultPipelineOptions, FfmpegState } from '../state/FfmpegState.ts';
import { FrameState } from '../state/FrameState.ts';
import { FrameSize } from '../types.ts';
import type { FfmpegVersionResult } from '../../ffmpegInfo.ts';
import type { StreamSource } from '../../../stream/types.ts';

// A full-screen block of text, so a burned frame differs clearly from the
// baseline in the bottom of the picture.
const Srt = `1
00:00:00,000 --> 00:00:10,000
WWWWWWWWWWWWWWWWWWWW
WWWWWWWWWWWWWWWWWWWW
`;

const Width = 1280;
const Height = 720;
const ProbeWidth = 320;
const ProbeHeight = 180;

function ffmpegPath(): string {
  if (!binaries) {
    throw new Error('ffmpeg binaries were not found');
  }
  return binaries.ffmpeg;
}

type RunResult = { code: number | null; stdout: Buffer; stderr: string };

// Async on purpose. A sync spawn would block the in-process HTTP server.
function run(bin: string, args: string[]): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const out: Buffer[] = [];
    let stderr = '';
    proc.stdout.on('data', (chunk: Buffer) => out.push(chunk));
    proc.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    proc.on('error', reject);
    proc.on('close', (code) =>
      resolve({ code, stdout: Buffer.concat(out), stderr }),
    );
  });
}

async function grabGrayFrame(ffmpeg: string, file: string): Promise<Buffer> {
  const { code, stdout, stderr } = await run(ffmpeg, [
    '-hide_banner',
    '-v',
    'error',
    '-i',
    file,
    '-ss',
    '1',
    '-frames:v',
    '1',
    '-vf',
    `scale=${ProbeWidth}:${ProbeHeight},format=gray`,
    '-f',
    'rawvideo',
    '-',
  ]);
  if (code !== 0 || stdout.length !== ProbeWidth * ProbeHeight) {
    throw new Error(`Frame grab failed for ${file}: ${stderr}`);
  }
  return stdout;
}

// Mean absolute luma difference between two frames, split into the top half
// and bottom quarter. Subtitles render near the bottom edge.
function regionDiffs(a: Buffer, b: Buffer) {
  const meanDiff = (fromRow: number, toRow: number) => {
    let sum = 0;
    for (let i = fromRow * ProbeWidth; i < toRow * ProbeWidth; i++) {
      sum += Math.abs((a[i] ?? 0) - (b[i] ?? 0));
    }
    return sum / ((toRow - fromRow) * ProbeWidth);
  };
  return {
    top: meanDiff(0, ProbeHeight / 2),
    bottom: meanDiff((ProbeHeight * 3) / 4, ProbeHeight),
  };
}

describe.skipIf(!binaries)('SubtitleFilter burn-in with real ffmpeg', () => {
  let workdir: string;
  let cleanup: () => Promise<void>;

  function makeVideoInput() {
    return VideoInputSource.withStream(
      new FileStreamSource(Fixtures.video720p),
      VideoStream.create({
        codec: 'h264',
        displayAspectRatio: '16:9',
        frameSize: FrameSize.withDimensions(Width, Height),
        index: 0,
        pixelFormat: new PixelFormatYuv420P(),
        providedSampleAspectRatio: null,
        colorFormat: null,
      }),
    );
  }

  async function transcode(
    outputName: string,
    subtitleSource: StreamSource | null,
    capabilities: FfmpegCapabilities,
    version: FfmpegVersionResult,
  ) {
    const subtitles = subtitleSource
      ? new SubtitlesInputSource(
          subtitleSource,
          [new ExternalSubtitleStream('subrip', SubtitleMethods.Burn)],
          SubtitleMethods.Burn,
        )
      : null;

    const builder = new SoftwarePipelineBuilder(
      makeVideoInput(),
      null,
      null,
      subtitles,
      null,
      capabilities,
    );

    const outputPath = path.join(workdir, outputName);
    const pipeline = builder.build(
      FfmpegState.create({
        version,
        outputLocation: FileOutputLocation(outputPath, true),
      }),
      new FrameState({
        isAnamorphic: false,
        scaledSize: FrameSize.withDimensions(Width, Height),
        paddedSize: FrameSize.withDimensions(Width, Height),
      }),
      DefaultPipelineOptions,
    );

    const args = pipeline.getCommandArgs();
    const result = await run(ffmpegPath(), args);
    return { ...result, args, outputPath };
  }

  let baseline: Promise<Buffer> | undefined;

  function getBaselineFrame(
    capabilities: FfmpegCapabilities,
    version: FfmpegVersionResult,
  ) {
    baseline ??= transcode('baseline.ts', null, capabilities, version).then(
      (result) => {
        if (result.code !== 0) {
          throw new Error(`Baseline transcode failed: ${result.stderr}`);
        }
        return grabGrayFrame(ffmpegPath(), result.outputPath);
      },
    );
    return baseline;
  }

  async function expectBurned(
    result: Awaited<ReturnType<typeof transcode>>,
    baselineFrame: Buffer,
  ) {
    expect(
      result.code,
      `ffmpeg failed\nargs: ${JSON.stringify(result.args)}\n${result.stderr}`,
    ).toBe(0);

    // Guards against a test bug where no subtitle filter reaches ffmpeg.
    expect(result.args.join(' ')).toContain('subtitles=');

    const frame = await grabGrayFrame(ffmpegPath(), result.outputPath);
    const { top, bottom } = regionDiffs(frame, baselineFrame);
    expect(
      bottom,
      'subtitle text should change the bottom of the frame',
    ).toBeGreaterThan(5);
    expect(bottom).toBeGreaterThan(top * 4);
  }

  beforeAll(async () => {
    ({ dir: workdir, cleanup } = await createTempWorkdir());
  });

  afterAll(() => cleanup());

  // Each case is [label, directory name, file name]. The directory and the
  // file both carry the awkward characters, as real library paths do.
  ffmpegTest.for([
    ['plain ASCII', 'Plain Movie', 'Plain.Movie.en.srt'],
    ['apostrophes', "Maggie's Plan", "Maggie's_Plan.he.srt"],
    ['commas', 'Juliet, Naked', 'Juliet,_Naked.he.srt'],
    ['semicolons', 'Part 1; Part 2', 'Part;1.srt'],
    ['colons', 'Title: Subtitle', 'Title:Sub.srt'],
    ['equals signs', 'Cut = Final', 'Cut=Final.srt'],
    ['square brackets', 'Movie [2026]', 'Movie [1080p].srt'],
    ['backslashes', 'Back\\slash', 'a\\b.srt'],
    ['percent signs', '100% Wolf', '100%.srt'],
    ['Unicode', 'Ocean’s Eleven', 'æon Flux 8½ WALL·E.srt'],
    [
      'every delimiter at once',
      "It's: A [Test], Really; x=y",
      "Don't, Stop; [Me]: a=b\\c.srt",
    ],
  ] as const)(
    'burns subtitles from a path with %s',
    async ([, dirName, fileName], { binaryCapabilities, ffmpegVersion }) => {
      const dir = path.join(workdir, dirName);
      await fs.mkdir(dir, { recursive: true });
      const subtitlePath = path.join(dir, fileName);
      await fs.writeFile(subtitlePath, Srt);

      const baselineFrame = await getBaselineFrame(
        binaryCapabilities,
        ffmpegVersion,
      );
      const result = await transcode(
        `out-${fileName.length}-${Date.now()}.ts`,
        new FileStreamSource(subtitlePath),
        binaryCapabilities,
        ffmpegVersion,
      );
      await expectBurned(result, baselineFrame);
    },
  );

  ffmpegTest(
    'burns subtitles from an HTTP URL whose path has delimiters',
    async ({ binaryCapabilities, ffmpegVersion }) => {
      const urlPath = "/Items/1/Subtitles/Title,_Name's;[x]=y.srt";
      const requested: string[] = [];
      const server = http.createServer((req, res) => {
        requested.push(req.url ?? '');
        if (req.url === urlPath) {
          res.writeHead(200, { 'Content-Type': 'application/x-subrip' });
          res.end(Srt);
        } else {
          res.writeHead(404);
          res.end();
        }
      });
      await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve),
      );

      try {
        const address = server.address();
        if (address === null || typeof address === 'string') {
          throw new Error('HTTP server has no TCP address');
        }
        const { port } = address;
        const url = `http://127.0.0.1:${port}${urlPath}`;
        const result = await transcode(
          'http.ts',
          new HttpStreamSource(url),
          binaryCapabilities,
          ffmpegVersion,
        );
        expect(requested).toContain(urlPath);
        await expectBurned(
          result,
          await getBaselineFrame(binaryCapabilities, ffmpegVersion),
        );
      } finally {
        await new Promise((resolve) => server.close(resolve));
      }
    },
  );
});
