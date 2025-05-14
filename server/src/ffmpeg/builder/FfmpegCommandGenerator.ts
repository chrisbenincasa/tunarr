import type { Nullable } from '@/types/util.js';
import { ifDefined } from '@/util/index.js';
import { filter, findIndex, first, flatMap, partition } from 'lodash-es';
import type { Dictionary } from 'ts-essentials';
import { BaseEncoder } from './encoder/BaseEncoder.ts';
import { ComplexFilter } from './filter/ComplexFilter.ts';
import { StreamSeekFilter } from './filter/StreamSeekFilter.ts';
import type { AudioInputSource } from './input/AudioInputSource.ts';
import type { ConcatInputSource } from './input/ConcatInputSource.ts';
import type { VideoInputSource } from './input/VideoInputSource.ts';
import type { WatermarkInputSource } from './input/WatermarkInputSource.ts';
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
    videoInputSource: Nullable<VideoInputSource>,
    audioInputSource: Nullable<AudioInputSource>,
    watermarkInputSource: Nullable<WatermarkInputSource>,
    concatInputSource: Nullable<ConcatInputSource>,
    steps: PipelineStep[],
  ): string[] {
    const args = [
      ...flatMap(filter(steps, isGlobalOption), (step) => step.options()),
    ];

    const includedPaths = new Set<string>();

    if (videoInputSource) {
      includedPaths.add(videoInputSource.path);
      args.push(
        ...videoInputSource.getInputOptions(),
        '-i',
        videoInputSource.path,
      );
    }

    if (audioInputSource && !includedPaths.has(audioInputSource.path)) {
      includedPaths.add(audioInputSource.path);
      args.push(
        ...audioInputSource.getInputOptions(),
        '-i',
        audioInputSource.path,
      );
    }

    if (watermarkInputSource && !includedPaths.has(watermarkInputSource.path)) {
      includedPaths.add(watermarkInputSource.path);
      args.push(
        ...watermarkInputSource.getInputOptions(),
        '-i',
        watermarkInputSource.path,
      );
    }

    if (concatInputSource) {
      args.push(
        ...concatInputSource.getInputOptions(),
        '-i',
        concatInputSource.path,
      );
    }

    args.push(
      ...flatMap(filter(steps, isFilterOption), (step) => step.options()),
    );

    const [complexFilterSteps, otherSteps] = partition(
      filter(steps, isOutputOption),
      (step) =>
        step instanceof ComplexFilter || step instanceof StreamSeekFilter,
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
