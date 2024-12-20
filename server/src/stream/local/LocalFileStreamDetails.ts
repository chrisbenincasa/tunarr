import { SettingsDB, getSettings } from '@/db/SettingsDB.ts';
import { FfmpegInfo } from '@/ffmpeg/ffmpegInfo.ts';
import { FfprobeAudioStream, FfprobeVideoStream } from '@/types/ffmpeg.ts';
import { Maybe, Nullable } from '@/types/util.ts';
import dayjs from '@/util/dayjs.ts';
import { fileExists } from '@/util/fsUtil.ts';
import { isNonEmptyString } from '@/util/index.ts';
import { LoggerFactory } from '@/util/logging/LoggerFactory.ts';
import { filter, find, isEmpty, map } from 'lodash-es';
import { NonEmptyArray } from 'ts-essentials';
import {
  AudioStreamDetails,
  FileStreamSource,
  HttpStreamSource,
  ProgramStreamResult,
  VideoStreamDetails,
} from '../types.ts';

export class LocalFileStreamDetails {
  private logger = LoggerFactory.child({ className: this.constructor.name });

  constructor(
    private path: string,
    private settingsDB: SettingsDB = getSettings(),
  ) {}

  async getStream(): Promise<Nullable<ProgramStreamResult>> {
    if (!(await fileExists(this.path))) {
      this.logger.warn('Cannot find file at path: %s', this.path);
      return null;
    }

    const ffmpegInfo = new FfmpegInfo(this.settingsDB.ffmpegSettings());

    const probeResult = await ffmpegInfo.probeFile(this.path);

    if (!probeResult) {
      return null;
    }

    const videoStream = find(
      probeResult.streams,
      (stream): stream is FfprobeVideoStream => stream.codec_type === 'video',
    );

    let videoDetails: Maybe<VideoStreamDetails>;
    if (videoStream) {
      videoDetails = {
        sampleAspectRatio: isNonEmptyString(videoStream?.sample_aspect_ratio)
          ? videoStream.sample_aspect_ratio
          : '1:1',
        scanType:
          videoStream.field_order === 'interlaced'
            ? 'interlaced'
            : videoStream.field_order === 'progressive'
            ? 'progressive'
            : 'unknown',
        width: videoStream.width,
        height: videoStream.height,
        framerate: videoStream.r_frame_rate ?? undefined,
        displayAspectRatio: videoStream.display_aspect_ratio,
        // chapters
        anamorphic: extractIsAnamorphic(
          videoStream.width,
          videoStream.height,
          videoStream.display_aspect_ratio,
        ),
        bitDepth: videoStream.bits_per_raw_sample,
        bitrate: videoStream.bit_rate,
        codec: videoStream.codec_name,
        profile: videoStream.profile?.toLowerCase(),
        streamIndex: videoStream.index?.toString() ?? '0',
      } satisfies VideoStreamDetails;
    }

    const audioStreamDetails = map(
      filter(
        probeResult.streams,
        (stream): stream is FfprobeAudioStream => stream.codec_type === 'audio',
      ),
      (audioStream) => {
        return {
          bitrate: audioStream.bit_rate ?? undefined,
          channels: audioStream.channels,
          codec: audioStream.codec_name,
          index: audioStream.index.toFixed(),
          language: audioStream.tags?.['language'],
          profile: audioStream.profile,
        } satisfies AudioStreamDetails;
      },
    );

    return {
      streamDetails: {
        videoDetails: videoDetails ? [videoDetails] : undefined,
        audioDetails: isEmpty(audioStreamDetails)
          ? undefined
          : (audioStreamDetails as NonEmptyArray<AudioStreamDetails>),
        duration: dayjs.duration({ seconds: probeResult.format.duration }),
      },
      streamSource: this.path.startsWith('http')
        ? new HttpStreamSource(this.path)
        : new FileStreamSource(this.path),
    };
  }
}

function extractIsAnamorphic(
  width: number,
  height: number,
  aspectRatioString: string,
) {
  const resolutionRatio = width / height;
  const [numS, denS] = aspectRatioString.split(':');
  const num = parseFloat(numS);
  const den = parseFloat(denS);
  if (isNaN(num) || isNaN(den)) {
    return false;
  }

  return Math.abs(resolutionRatio - num / den) > 0.01;
}
