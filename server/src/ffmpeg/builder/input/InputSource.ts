import { flatMap } from 'lodash-es';
import {
  FileStreamSource,
  FilterStreamSource,
  HttpStreamSource,
} from '../../../stream/types.ts';
import { MediaStream } from '../MediaStream.ts';
import { HttpHeadersInputOption } from '../options/input/HttpHeadersInputOption.ts';
import { InputOption } from '../options/input/InputOption.ts';
import { HasFilterOption } from '../types/PipelineStep.ts';
import { VideoInputSource } from './VideoInputSource.ts';

export type InputSourceType = 'video' | 'audio';
export type InputSourceProtocol = 'file' | 'http' | 'filter';
export type InputSourceContinuity = 'discrete' | 'infinite';

// TODO: Clean this up
export type StreamSource =
  | HttpStreamSource
  | FileStreamSource
  | FilterStreamSource;

export abstract class InputSource<
  StreamType extends MediaStream = MediaStream,
> {
  abstract type: InputSourceType;
  abstract streams: StreamType[];

  readonly protocol: InputSourceProtocol;

  inputOptions: InputOption[] = [];
  filterSteps: HasFilterOption[] = [];

  constructor(
    public source: StreamSource,
    public continuity: InputSourceContinuity = 'discrete',
  ) {
    this.protocol = source.type;

    if (this.source.type === 'http') {
      this.addOptions(new HttpHeadersInputOption());
    }
  }

  get path() {
    return this.source.path;
  }

  addOption(option: InputOption) {
    this.addOptions(option);
  }

  addOptions(...options: InputOption[]) {
    for (const opt of options) {
      if (opt.appliesToInput(this)) {
        this.inputOptions.push(opt);
      }
    }
  }

  // This isn't ideal since it means the parent
  // class knows of its children... we can find a
  // better way. it's also technically not true
  // since something else could extend this and
  // set their type to video
  isVideo(): this is VideoInputSource {
    return this.type === 'video';
  }

  getInputOptions(): string[] {
    return flatMap(this.inputOptions, (opt) => opt.options(this));
  }
}
