import { FfmpegCommandGenerator } from '@/ffmpeg/builder/FfmpegCommandGenerator.ts';
import { PipelineStep } from '@/ffmpeg/builder/types/PipelineStep.ts';
import { Dictionary } from 'ts-essentials';
import { PipelineInputs } from './PipelineInputs.ts';

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
}
