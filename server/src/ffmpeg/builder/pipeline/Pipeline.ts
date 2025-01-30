import { FfmpegCommandGenerator } from '@/ffmpeg/builder/FfmpegCommandGenerator.js';
import type { PipelineStep } from '@/ffmpeg/builder/types/PipelineStep.js';
import type { Dictionary } from 'ts-essentials';
import type { PipelineInputs } from './PipelineInputs.ts';

/**
 * Result from invoking a {@link PipelineBuilder}
 */
export class Pipeline {
  #commandGenerator = new FfmpegCommandGenerator();

  constructor(
    public steps: PipelineStep[],
    public inputs: PipelineInputs,
    private isIntelBasedHwAccel: boolean,
  ) {}

  getCommandArgs(): string[] {
    return this.#commandGenerator.generateArgs(
      this.inputs,
      this.steps,
      this.isIntelBasedHwAccel,
    );
  }

  setInputs(inputs: PipelineInputs) {
    this.inputs = inputs;
  }

  getCommandEnvironment(): Dictionary<string> {
    return this.#commandGenerator.generateEnvrionmentVariables(this.steps);
  }
}
