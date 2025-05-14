import type { MediaStream } from '@/ffmpeg/builder/MediaStream.js';
import { HttpHeadersInputOption } from '@/ffmpeg/builder/options/input/HttpHeadersInputOption.js';
import type { InputOption } from '@/ffmpeg/builder/options/input/InputOption.js';
import type { HasFilterOption } from '@/ffmpeg/builder/types/PipelineStep.js';
import { flatMap } from 'lodash-es';
import type { Newable, NonEmptyArray } from 'ts-essentials';
import type {
  FileStreamSource,
  FilterStreamSource,
  HttpStreamSource,
} from '../../../stream/types.ts';
import type { Nullable } from '../../../types/util.ts';
import type { FilterOption } from '../filter/FilterOption.ts';
import type { VideoInputSource } from './VideoInputSource.ts';

export type InputSourceType = 'video' | 'audio' | 'subtitle';
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

  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  hasInputOption(typ: Newable<InputOption> | Function) {
    return this.inputOptions.some((io) => io instanceof typ);
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  getInputOption<Inst>(inst: Newable<Inst> | Function): Nullable<Inst> {
    return (this.inputOptions.find((io) => io instanceof inst) ??
      null) as Nullable<Inst>;
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

  hasAnyFilterStep(stepTs: NonEmptyArray<Newable<HasFilterOption>>): boolean {
    return this.filterSteps.some((filterStep) => {
      return stepTs.some((s) => filterStep instanceof s);
    });
  }

  addFilter(opt: FilterOption): this {
    this.filterSteps.push(opt);
    return this;
  }
}
