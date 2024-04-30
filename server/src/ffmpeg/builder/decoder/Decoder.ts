import { InputOption } from '../options/input/InputOption.ts';

export abstract class Decoder extends InputOption {
  abstract readonly name: string;
}
