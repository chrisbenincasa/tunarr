import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import z from 'zod';
import { NvidiaHardwareCapabilities } from '../../ffmpeg/builder/capabilities/NvidiaHardwareCapabilities.ts';
import { parseNvidiaModelAndArchitecture } from '../../ffmpeg/builder/capabilities/NvidiaHardwareCapabilitiesFactory.ts';
import { QsvHardwareCapabilities } from '../../ffmpeg/builder/capabilities/QsvHardwareCapabilities.ts';
import type { VaapiHardwareCapabilities } from '../../ffmpeg/builder/capabilities/VaapiHardwareCapabilities.ts';
import { VaapiHardwareCapabilitiesParser } from '../../ffmpeg/builder/capabilities/VaapiHardwareCapabilitiesParser.ts';
import { FfprobeMediaInfoSchema } from '../../types/ffmpeg.ts';

function whichFirst(...candidates: string[]): string {
  for (const candidate of candidates) {
    try {
      const result = execFileSync('which', [candidate], {
        encoding: 'utf-8' as const,
      }).trim();
      if (result) return result;
    } catch {
      // not found, try next
    }
  }
  return '';
}

export function discoverFfmpegBinaries(): {
  ffmpeg: string;
  ffprobe: string;
} | null {
  try {
    const ffmpeg =
      process.env['TUNARR_TEST_FFMPEG'] ?? whichFirst('ffmpeg7.1', 'ffmpeg');

    const ffprobe =
      process.env['TUNARR_TEST_FFPROBE'] ?? whichFirst('ffprobe7.1', 'ffprobe');

    if (!ffmpeg || !ffprobe) {
      return null;
    }

    console.debug('Resolved ffmpeg binaries: ', ffmpeg, ffprobe);

    return { ffmpeg, ffprobe };
  } catch {
    return null;
  }
}

export async function createTempWorkdir(): Promise<{
  dir: string;
  cleanup: () => Promise<void>;
}> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tunarr-ffmpeg-test-'));
  return {
    dir,
    cleanup: () => fs.rm(dir, { recursive: true, force: true }),
  };
}

export function generateTestMediaFile(
  ffmpegPath: string,
  outputPath: string,
): void {
  const result = spawnSync(
    ffmpegPath,
    [
      '-f',
      'lavfi',
      '-i',
      'testsrc=size=1280x720:rate=30,format=yuv420p',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=1000:duration=3',
      '-t',
      '3',
      '-c:v',
      'libx264',
      '-c:a',
      'aac',
      '-y',
      outputPath,
    ],
    { stdio: 'ignore' },
  );

  if (result.status !== 0) {
    throw new Error(
      `Failed to generate test media file, exit code: ${result.status}`,
    );
  }
}

export function runFfmpegWithPipeline(
  ffmpegPath: string,
  pipelineArgs: string[],
) {
  const result = spawnSync(ffmpegPath, pipelineArgs, {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  if (result.status !== 0) {
    console.error('ffmpeg failed with stderr: ', result.stderr);
  }
  return { exitCode: result.status ?? -1, stderr: result.stderr };
}

export function probeFile(
  ffprobePath: string,
  filePath: string,
): z.infer<typeof FfprobeMediaInfoSchema> {
  const result = spawnSync(
    ffprobePath,
    [
      '-hide_banner',
      '-v',
      'quiet',
      '-print_format',
      'json',
      '-show_format',
      '-show_chapters',
      '-show_streams',
      filePath,
    ],
    { encoding: 'utf-8' as const },
  );

  const parsed = FfprobeMediaInfoSchema.parse(JSON.parse(result.stdout), {
    reportInput: true,
  });

  return parsed;
}

// ---------------------------------------------------------------------------
// Hardware discovery helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if an OpenCL device can be derived from the given VAAPI device,
 * which is the prerequisite for tonemap_opencl pipelines.
 *
 * Uses -init_hw_device vaapi=va:<device> -init_hw_device opencl=ocl@va — the
 * same device-init approach the pipeline builder uses when OpenCL tonemap is
 * active. A synthetic lavfi source is used so no input file is required; we
 * only care that device initialisation succeeds (exit 0), not that any filter
 * chain runs.
 */
export function discoverVaapiOpenclSupport(
  ffmpegPath: string,
  device: string,
): boolean {
  try {
    const result = spawnSync(
      ffmpegPath,
      [
        '-hide_banner',
        '-init_hw_device',
        `vaapi=va:${device}`,
        '-init_hw_device',
        'opencl=ocl@va',
        '-f',
        'lavfi',
        '-i',
        'nullsrc=s=64x64',
        '-frames:v',
        '1',
        '-f',
        'null',
        '-',
      ],
      { encoding: 'utf-8' as const },
    );
    return result.status === 0;
  } catch {
    return false;
  }
}

export type VaapiDeviceInfo = {
  device: string;
  capabilities: VaapiHardwareCapabilities;
};

/**
 * Returns VAAPI device info if a compatible device exists and vainfo can parse
 * its capabilities, otherwise null. Reads TUNARR_TEST_VAAPI_DEVICE to override
 * the default /dev/dri/renderD128 path.
 */
export function discoverVaapiDevice(): VaapiDeviceInfo | null {
  const device =
    process.env['TUNARR_TEST_VAAPI_DEVICE'] ?? '/dev/dri/renderD128';

  try {
    if (!existsSync(device)) {
      return null;
    }

    const result = spawnSync(
      'vainfo',
      ['--display', 'drm', '--device', device, '-a'],
      { encoding: 'utf-8' as const },
    );

    // vainfo may write to stdout or stderr depending on version; combine both
    const output = (result.stdout ?? '') + (result.stderr ?? '');
    if (!output.includes('VAProfile')) {
      return null;
    }

    const capabilities =
      VaapiHardwareCapabilitiesParser.extractAllFromVaInfo(output);
    if (!capabilities) {
      return null;
    }

    return { device, capabilities };
  } catch {
    return null;
  }
}

/**
 * Returns QSV capabilities if VAAPI is available and the ffmpeg binary
 * supports h264_qsv decoding, otherwise null.
 */
export function discoverQsvCapabilities(
  ffmpegPath: string,
): { device: string; capabilities: QsvHardwareCapabilities } | null {
  const vaapi = discoverVaapiDevice();
  if (!vaapi) {
    return null;
  }

  try {
    const result = spawnSync(
      ffmpegPath,
      ['-hide_banner', '-help', 'decoder=h264_qsv'],
      { encoding: 'utf-8' as const },
    );

    const output = result.stdout ?? '';
    // If the decoder is unknown, ffmpeg exits non-zero and prints an error
    if (result.status !== 0 || output.includes('Codec h264_qsv is not')) {
      return null;
    }

    // Replicate QsvHardwareCapabilitiesFactory.getDecoderOptions() parsing
    const decoderOptions: string[] = [];
    const optionPattern = /^-([a-z_]+)\s+.*/m;
    for (const line of output.split('\n').slice(1)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const match = trimmed.match(optionPattern);
      if (match?.[1]) {
        decoderOptions.push(match[1]);
      }
    }

    return {
      device: vaapi.device,
      capabilities: new QsvHardwareCapabilities(
        vaapi.capabilities,
        decoderOptions,
      ),
    };
  } catch {
    return null;
  }
}

/**
 * Returns NvidiaHardwareCapabilities if an NVIDIA GPU is detectable via
 * h264_nvenc, otherwise null.
 */
export function discoverNvidiaCapabilities(
  ffmpegPath: string,
): NvidiaHardwareCapabilities | null {
  try {
    const result = spawnSync(
      ffmpegPath,
      [
        '-hide_banner',
        '-f',
        'lavfi',
        '-i',
        'nullsrc',
        '-c:v',
        'h264_nvenc',
        '-gpu',
        'list',
        '-f',
        'null',
        '-',
      ],
      { encoding: 'utf-8' as const },
    );

    // GPU list is written to stderr by ffmpeg
    const allOutput = (result.stdout ?? '') + (result.stderr ?? '');
    for (const line of allOutput.split('\n')) {
      const parsed = parseNvidiaModelAndArchitecture(line);
      if (parsed) {
        return new NvidiaHardwareCapabilities(
          parsed.model,
          parsed.architecture,
        );
      }
    }

    return null;
  } catch {
    return null;
  }
}
