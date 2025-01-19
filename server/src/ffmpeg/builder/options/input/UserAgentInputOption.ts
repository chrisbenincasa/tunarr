import { MediaStream } from '@/ffmpeg/builder/MediaStream.js';
import { InputSource } from '@/ffmpeg/builder/input/InputSource.js';
import { InputOption } from './InputOption.ts';

export class UserAgentInputOption extends InputOption {
  constructor(private userAgent: string) {
    super();
  }

  appliesToInput(input: InputSource<MediaStream>): boolean {
    return input.protocol === 'http';
  }

  options(): string[] {
    return ['-user_agent', `${this.userAgent}`];
  }
}
