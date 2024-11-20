import { makeConstantOutputOption } from './OutputOption.ts';

export const AudioChannelsOutputOption = (
  audioFormat: string,
  sourceChannels: number,
  desiredChannels: number,
) => {
  const opts: string[] = [];
  if (
    sourceChannels !== desiredChannels ||
    (audioFormat === 'aac' && desiredChannels > 2)
  ) {
    opts.push('-ac', desiredChannels.toString());
  }

  return makeConstantOutputOption(opts);
};

export const AudioBitrateOutputOption = (bitrate: number) =>
  makeConstantOutputOption([
    '-b:a',
    `${bitrate}k`,
    '-maxrate:a',
    `${bitrate}k`,
  ]);

export const AudioBufferSizeOutputOption = (bufSize: number) =>
  makeConstantOutputOption(['-bufsize:a', `${bufSize}k`]);

export const AudioSampleRateOutputOption = (rate: number) =>
  makeConstantOutputOption(['-ar', `${rate}k`]);
