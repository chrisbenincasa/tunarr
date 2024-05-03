import { InputOption } from '../options/InputOption.js';

export abstract class Decoder extends InputOption {
  abstract readonly name: string;
}
