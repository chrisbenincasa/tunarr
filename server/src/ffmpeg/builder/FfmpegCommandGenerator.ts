import { ifDefined } from '@/util/index.js';
import { filter, findIndex, first, flatMap, partition } from 'lodash-es';
import type { Dictionary } from 'ts-essentials';
import { BaseEncoder } from './encoder/BaseEncoder.ts';
import { ComplexFilter } from './filter/ComplexFilter.ts';
import { type PipelineInputs } from './pipeline/PipelineInputs.ts';
import type { PipelineStep } from './types/PipelineStep.ts';
import {
  isFilterOption,
  isGlobalOption,
  isOutputOption,
} from './types/PipelineStep.ts';

export class FfmpegCommandGenerator {
  generateEnvrionmentVariables(steps: PipelineStep[]) {
    const out: Dictionary<string, string> = {};
    for (const step of steps) {
      if (step.type === 'environment') {
        const opts = step.options();
        for (const [key, value] of Object.entries(opts)) {
          out[key] = value;
        }
      }
    }
    return out;
  }

  generateArgs(
    { videoInput, audioInput, watermarkInput, concatInput }: PipelineInputs,
    steps: PipelineStep[],
    isIntelBasedHwAccel: boolean,
  ): string[] {
    const args = [
      ...flatMap(filter(steps, isGlobalOption), (step) => step.options()),
    ];

    const includedPaths = new Set<string>();

    if (videoInput) {
      includedPaths.add(videoInput.path);
      args.push(...videoInput.getInputOptions(), '-i', videoInput.path);
    }

    if (
      audioInput &&
      (!includedPaths.has(audioInput.path) || isIntelBasedHwAccel)
    ) {
      includedPaths.add(audioInput.path);
      args.push(...audioInput.getInputOptions(), '-i', audioInput.path);
    }

    if (watermarkInput && !includedPaths.has(watermarkInput.path)) {
      includedPaths.add(watermarkInput.path);
      args.push(...watermarkInput.getInputOptions(), '-i', watermarkInput.path);
    }

    if (concatInput) {
      args.push(...concatInput.getInputOptions(), '-i', concatInput.path);
    }

    args.push(
      ...flatMap(filter(steps, isFilterOption), (step) => step.options()),
    );

    const [complexFilterSteps, otherSteps] = partition(
      filter(steps, isOutputOption),
      (step) => step instanceof ComplexFilter,
    );
    // sort, filter complex, etc

    // We only support one
    const sortedSteps = otherSteps;
    ifDefined(first(complexFilterSteps), (complexFilter) => {
      const encoderIndex = findIndex(
        sortedSteps,
        (step) => step instanceof BaseEncoder && step.kind === 'video',
      );
      sortedSteps.splice(encoderIndex + 1, 0, complexFilter);
    });

    args.push(...flatMap(sortedSteps, (step) => step.options()));

    return args;
  }
}

// const emptyStepMap = (): Record<PipelineStepType, PipelineSteps[]> => ({
//   filter: [],
//   global: [],
//   input: [],
//   output: [],
// });
