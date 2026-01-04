import { FfmpegInfo } from '@/ffmpeg/ffmpegInfo.js';
import type {
  FfprobeAudioStream,
  FfprobeSubtitleStream,
  FfprobeVideoStream,
} from '@/types/ffmpeg.js';
import type { Maybe } from '@/types/util.js';
import dayjs from '@/util/dayjs.js';
import {
  isDefined,
  isNonEmptyArray,
  isNonEmptyString,
  parseFloatOrNull,
} from '@/util/index.js';
import { seq } from '@tunarr/shared/util';
import { MediaChapter } from '@tunarr/types';
import { inject, injectable } from 'inversify';
import { filter, find, isEmpty, isNull, map, orderBy } from 'lodash-es';
import type { NonEmptyArray } from 'ts-essentials';
import { LanguageService } from '../services/LanguageService.ts';
import { Result } from '../types/result.ts';
import { StreamDetailsFetcher } from './ExternalStreamDetailsFetcher.ts';
import type {
  AudioStreamDetails,
  ProgramStreamResult,
  SubtitleStreamDetails,
  VideoStreamDetails,
} from './types.ts';
import { FileStreamSource, HttpStreamSource } from './types.ts';

type FfprobeStreamDetailsRequest = {
  path: string;
};

@injectable()
export class FfprobeStreamDetails
  implements StreamDetailsFetcher<FfprobeStreamDetailsRequest>
{
  constructor(@inject(FfmpegInfo) private ffmpegInfo: FfmpegInfo) {}

  async getStream({
    path,
  }: FfprobeStreamDetailsRequest): Promise<Result<ProgramStreamResult>> {
    const probeResult = (
      await Result.attemptAsync(() => this.ffmpegInfo.probeFile(path))
    ).filter(isDefined);

    if (probeResult.isFailure()) {
      return probeResult.recast();
    }

    const probeDetails = probeResult.get();

    const videoStream = find(
      probeDetails.streams,
      (stream): stream is FfprobeVideoStream => stream.codec_type === 'video',
    );

    let videoDetails: Maybe<VideoStreamDetails>;
    if (videoStream) {
      const displayAspectRatio =
        videoStream.display_aspect_ratio ??
        `${videoStream.coded_width / videoStream.coded_height}`;
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
        displayAspectRatio,
        // chapters
        anamorphic: extractIsAnamorphic(
          videoStream.width,
          videoStream.height,
          displayAspectRatio,
        ),
        pixelFormat: videoStream.pix_fmt,
        bitDepth: videoStream.bits_per_raw_sample,
        bitrate: videoStream.bit_rate,
        codec: videoStream.codec_name,
        profile: videoStream.profile?.toLowerCase(),
        streamIndex: videoStream.index,
        colorPrimaries: videoStream.color_primaries,
        colorRange: videoStream.color_range,
        colorSpace: videoStream.color_space,
        colorTransfer: videoStream.color_transfer,
      } satisfies VideoStreamDetails;
    }

    const audioStreamDetails = map(
      filter(
        probeDetails.streams,
        (stream): stream is FfprobeAudioStream => stream.codec_type === 'audio',
      ),
      (audioStream) => {
        const lang = audioStream.tags?.['language'];
        return {
          bitrate: audioStream.bit_rate ?? undefined,
          channels: audioStream.channels,
          codec: audioStream.codec_name,
          index: audioStream.index,
          language:
            lang && LanguageService.isValidLanguageCode(lang)
              ? lang
              : undefined,
          languageCodeISO6392: lang
            ? LanguageService.getAlpha3TCode(lang)
            : undefined,
          profile: audioStream.profile,
        } satisfies AudioStreamDetails;
      },
    );

    const subtitleStreamDetails = map(
      filter(
        probeDetails.streams,
        (stream): stream is FfprobeSubtitleStream =>
          stream.codec_type === 'subtitle',
      ),
      (stream) => {
        const lang = stream.tags?.['language'];
        const validLang =
          lang && LanguageService.isValidLanguageCode(lang) ? lang : undefined;
        return {
          type: 'embedded',
          codec: stream.codec_name,
          index: stream.index,
          default: stream.disposition?.default === 1,
          forced: stream.disposition?.forced === 1,
          sdh: stream.disposition?.hearing_impaired === 1,
          language: validLang,
          languageCodeISO6392: validLang
            ? LanguageService.getAlpha3TCode(validLang)
            : undefined,
        } satisfies SubtitleStreamDetails;
      },
    );

    return Result.success({
      streamDetails: {
        videoDetails: videoDetails ? [videoDetails] : undefined,
        audioDetails: isEmpty(audioStreamDetails)
          ? undefined
          : (audioStreamDetails as NonEmptyArray<AudioStreamDetails>),
        subtitleDetails: isNonEmptyArray(subtitleStreamDetails)
          ? subtitleStreamDetails
          : undefined,
        duration: dayjs.duration({ seconds: probeDetails.format.duration }),
        chapters: seq.collect(
          orderBy(probeDetails.chapters, (c) => c.start, 'asc'),
          (chapter, index) => {
            const startSeconds = parseFloatOrNull(chapter.start_time);
            const endSeconds = parseFloatOrNull(chapter.end_time);
            if (isNull(startSeconds) || isNull(endSeconds)) {
              return;
            }

            return {
              chapterType: 'chapter',
              index,
              startTime: dayjs
                .duration({ seconds: startSeconds })
                .asMilliseconds(),
              endTime: dayjs.duration({ seconds: endSeconds }).asMilliseconds(),
              title: chapter?.tags?.['title'],
            } satisfies MediaChapter;
          },
        ),
      },
      streamSource: path.startsWith('http')
        ? new HttpStreamSource(path)
        : new FileStreamSource(path),
    });
  }
}

function extractIsAnamorphic(
  width: number,
  height: number,
  aspectRatioString: string,
) {
  const resolutionRatio = width / height;
  const [numS, denS] = aspectRatioString.split(':');
  const num = parseFloat(numS!);
  const den = parseFloat(denS!);
  if (isNaN(num) || isNaN(den)) {
    return false;
  }

  return Math.abs(resolutionRatio - num / den) > 0.01;
}
