import { FfmpegCommandGenerator } from '@/ffmpeg/builder/FfmpegCommandGenerator.js';
import type { PipelineStep } from '@/ffmpeg/builder/types/PipelineStep.js';
import type { Dictionary } from 'ts-essentials';
import type { Maybe } from '../../../types/util.ts';
import { ComplexFilter } from '../filter/ComplexFilter.ts';
import type { PipelineInputs } from './PipelineInputs.ts';

/**
 * Result from invoking a {@link PipelineBuilder}
 */
export class Pipeline {
  #commandGenerator = new FfmpegCommandGenerator();

  constructor(
    public steps: PipelineStep[],
    public inputs: PipelineInputs,
  ) {}

  getCommandArgs(): string[] {
    return this.#commandGenerator.generateArgs(
      this.inputs.videoInput,
      this.inputs.audioInput,
      this.inputs.watermarkInput,
      this.inputs.concatInput,
      this.steps,
    );
  }

  setInputs(inputs: PipelineInputs) {
    this.inputs = inputs;
  }

  getCommandEnvironment(): Dictionary<string> {
    return this.#commandGenerator.generateEnvrionmentVariables(this.steps);
  }

  getComplexFilter(): Maybe<ComplexFilter> {
    return this.steps.find((step) => step instanceof ComplexFilter);
  }
}
