import { InputOption } from '@/ffmpeg/builder/options/input/InputOption.js';

export abstract class Decoder extends InputOption {
  abstract readonly name: string;
}
