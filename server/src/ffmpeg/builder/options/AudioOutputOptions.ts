import { AudioFormats } from '../constants.ts';
import {
  type ConstantOutputOption,
  makeConstantOutputOption,
} from './OutputOption.ts';

export const AudioChannelsOutputOption = (
  audioFormat: string,
  sourceChannels: number,
  desiredChannels: number,
): ConstantOutputOption => {
  const opts: string[] = [];
  if (
    sourceChannels !== desiredChannels ||
    (audioFormat === AudioFormats.Aac && desiredChannels > 2)
  ) {
    opts.push('-ac', desiredChannels.toString());
  }

  return makeConstantOutputOption(opts);
};

export const AudioBitrateOutputOption = (
  bitrate: number,
): ConstantOutputOption =>
  makeConstantOutputOption([
    '-b:a',
    `${bitrate}k`,
    '-maxrate:a',
    `${bitrate}k`,
  ]);

export const AudioBufferSizeOutputOption = (
  bufSize: number,
): ConstantOutputOption =>
  makeConstantOutputOption(['-bufsize:a', `${bufSize}k`]);

export const AudioSampleRateOutputOption = (
  rate: number,
): ConstantOutputOption => makeConstantOutputOption(['-ar', `${rate}k`]);
