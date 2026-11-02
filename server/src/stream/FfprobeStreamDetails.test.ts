import { FfprobeMediaInfoSchema } from '@/types/ffmpeg.js';
import { describe, expect, test } from 'vitest';
import { FfprobeStreamDetails } from './FfprobeStreamDetails.ts';

// Regression tests for https://github.com/chrisbenincasa/tunarr/issues/2242
//
// Cover art embedded in a local audio file is a `video` stream flagged
// `attached_pic`. `FfprobeStreamDetails` used to take the first `video` stream
// unconditionally, so the track was stored with a video stream and the channel
// handed ffmpeg a ~300x300 mjpeg as its video input instead of looping a
// placeholder over the audio.
//
// The payloads below are the real ffprobe output for the two files built by
// FfprobeStreamDetails.local.test.ts, trimmed to the fields the schema reads.

const taggedMp3Probe = {
  streams: [
    {
      index: 0,
      codec_name: 'mp3',
      codec_long_name: 'MP3 (MPEG audio layer 3)',
      codec_type: 'audio',
      sample_fmt: 'fltp',
      sample_rate: '44100',
      channels: 1,
      channel_layout: 'mono',
      bit_rate: '64000',
      disposition: {
        default: 0,
        attached_pic: 0,
      },
    },
    {
      index: 1,
      codec_name: 'mjpeg',
      codec_long_name: 'Motion JPEG',
      profile: 'Baseline',
      codec_type: 'video',
      width: 300,
      height: 300,
      coded_width: 300,
      coded_height: 300,
      has_b_frames: 0,
      sample_aspect_ratio: '1:1',
      display_aspect_ratio: '1:1',
      pix_fmt: 'yuvj420p',
      color_range: 'pc',
      color_space: 'bt470bg',
      r_frame_rate: '90000/1',
      avg_frame_rate: '0/0',
      bits_per_raw_sample: '8',
      disposition: {
        default: 0,
        attached_pic: 1,
      },
    },
  ],
  format: {
    filename: 'tagged.mp3',
    nb_streams: 2,
    format_name: 'mp3',
    duration: '4.000000',
    size: '33406',
    bit_rate: '66812',
  },
};

const taggedMp4Probe = {
  streams: [
    {
      index: 0,
      codec_name: 'h264',
      codec_long_name: 'H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10',
      profile: 'High',
      codec_type: 'video',
      width: 1280,
      height: 720,
      coded_width: 1280,
      coded_height: 720,
      has_b_frames: 2,
      sample_aspect_ratio: '1:1',
      display_aspect_ratio: '16:9',
      pix_fmt: 'yuv420p',
      field_order: 'progressive',
      r_frame_rate: '30/1',
      avg_frame_rate: '30/1',
      bit_rate: '159520',
      bits_per_raw_sample: '8',
      disposition: {
        default: 1,
        attached_pic: 0,
      },
    },
    {
      index: 1,
      codec_name: 'aac',
      codec_type: 'audio',
      profile: 'LC',
      sample_fmt: 'fltp',
      sample_rate: '44100',
      channels: 1,
      channel_layout: 'mono',
      bit_rate: '69090',
      disposition: {
        default: 1,
        attached_pic: 0,
      },
    },
    {
      index: 2,
      codec_name: 'mjpeg',
      codec_long_name: 'Motion JPEG',
      profile: 'Baseline',
      codec_type: 'video',
      width: 300,
      height: 300,
      coded_width: 300,
      coded_height: 300,
      has_b_frames: 0,
      sample_aspect_ratio: '1:1',
      display_aspect_ratio: '1:1',
      pix_fmt: 'yuvj420p',
      color_range: 'pc',
      color_space: 'bt470bg',
      r_frame_rate: '90000/1',
      avg_frame_rate: '0/0',
      bits_per_raw_sample: '8',
      disposition: {
        default: 0,
        attached_pic: 1,
      },
    },
  ],
  format: {
    filename: 'tagged.mp4',
    nb_streams: 3,
    format_name: 'mov,mp4,m4a,3gp,3g2,mj2',
    duration: '3.041814',
    size: '91580',
    bit_rate: '240856',
  },
};

function makeSubject(probe: unknown) {
  // The probe output goes through the real schema so the payloads above have to
  // stay parseable exactly as ffprobe writes them. Only `probeFile` is handed
  // over - the constructor takes that one method - so a rename or a signature
  // change in FfmpegInfo breaks this test instead of being swallowed by a cast.
  return new FfprobeStreamDetails({
    probeFile: async () => FfprobeMediaInfoSchema.parse(probe),
  });
}

describe('FfprobeStreamDetails attached pictures', () => {
  test('a track whose only video stream is its cover art has no video details', async () => {
    const { streamDetails } = (
      await makeSubject(taggedMp3Probe).getStream({ path: '/music/tagged.mp3' })
    ).getOrThrow();

    expect(streamDetails.videoDetails).toBeUndefined();
    expect(streamDetails.audioDetails).toHaveLength(1);
    expect(streamDetails.audioDetails?.[0]?.codec).toBe('mp3');
  });

  test('a file with a real video stream keeps it and ignores its cover art', async () => {
    const { streamDetails } = (
      await makeSubject(taggedMp4Probe).getStream({
        path: '/movies/tagged.mp4',
      })
    ).getOrThrow();

    expect(streamDetails.videoDetails).toHaveLength(1);
    expect(streamDetails.videoDetails?.[0]?.codec).toBe('h264');
    expect(streamDetails.videoDetails?.[0]?.width).toBe(1280);
    expect(streamDetails.videoDetails?.[0]?.isAttachedPic).toBe(false);
  });
});
