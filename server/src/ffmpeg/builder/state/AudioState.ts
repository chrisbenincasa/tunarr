import { Nullable } from '../../../types/util';

export type AudioState = {
  audioEncoder: string;
  audioChannels: number;
  audioBitrate: Nullable<number>;
  audioBufferSize: Nullable<number>;
  audioSampleRate: Nullable<number>;
  audioDuration: Nullable<number>;
  audioVolume: Nullable<number>;
};

const DefaultAudioState: AudioState = {
  audioEncoder: 'aac',
  audioChannels: 2,
  audioBitrate: null,
  audioBufferSize: null,
  audioSampleRate: null,
  audioDuration: null,
  audioVolume: null,
};

export function AudioState(fields: Partial<AudioState> = {}): AudioState {
  return {
    ...DefaultAudioState,
    ...fields,
  };
}
