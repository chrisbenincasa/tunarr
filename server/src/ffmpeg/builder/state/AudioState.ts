import type { ExcludeByValueType, Nullable } from '@/types/util.js';
import { isNil, omitBy } from 'lodash-es';
import type { AnyFunction } from 'ts-essentials';
import type { TranscodeAudioOutputFormat } from '../../../db/schema/TranscodeConfig.ts';

export type AudioStateFields = ExcludeByValueType<AudioState, AnyFunction>;

const DefaultAudioState: AudioState = {
  audioEncoder: 'aac',
  audioChannels: 2,
  audioBitrate: null,
  audioBufferSize: null,
  audioSampleRate: null,
  audioDuration: null,
  audioVolume: null,
};

export class AudioState {
  audioEncoder: TranscodeAudioOutputFormat;
  audioChannels: Nullable<number>;
  audioBitrate: Nullable<number>;
  audioBufferSize: Nullable<number>;
  audioSampleRate: Nullable<number>;
  audioDuration: Nullable<number>;
  audioVolume: Nullable<number>;

  private constructor(fields: Partial<AudioStateFields> = {}) {
    const merged: AudioStateFields = {
      ...DefaultAudioState,
      ...omitBy(fields, isNil),
    };
    this.audioEncoder = merged.audioEncoder;
    this.audioChannels = merged.audioChannels;
    this.audioBitrate = merged.audioBitrate;
    this.audioBufferSize = merged.audioBufferSize;
    this.audioSampleRate = merged.audioSampleRate;
    this.audioDuration = merged.audioDuration;
    this.audioVolume = merged.audioVolume;
  }

  static create(fields: Partial<AudioStateFields> = {}) {
    return new AudioState(fields);
  }
}
