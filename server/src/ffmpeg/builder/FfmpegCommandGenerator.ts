import {
  findIndex,
  first,
  flatMap,
  isNull,
  partition,
  reduce,
} from 'lodash-es';
import { ifDefined } from '../../util';
import { BaseEncoder } from './encoder/BaseEncoder';
import { ComplexFilter } from './filter/ComplexFilter';
import {
  AudioInputSource,
  PipelineStep,
  PipelineStepType,
  VideoInputSource,
  WatermarkInputSource,
} from './types';
import { Nullable } from '../../types/util';

export class FfmpegCommandGenerator {
  generateArgs(
    videoInputSource: VideoInputSource,
    audioInputSource: Nullable<AudioInputSource>,
    watermarkInputSource: Nullable<WatermarkInputSource>,
    steps: PipelineStep[],
  ): string[] {
    const stepsByType = reduce(
      steps,
      (prev, curr) => ({ ...prev, [curr.type]: [...prev[curr.type], curr] }),
      emptyStepMap(),
    );
    // const args: string[] = [...flatMap(steps, (step) => step.globalOptions())];
    const args = [...flatMap(stepsByType['global'], (step) => step.options())];

    const includedPaths = new Set<string>([videoInputSource.path]);

    args.push(
      ...videoInputSource.getInputOptions(),
      '-i',
      videoInputSource.path,
    );

    if (
      !isNull(audioInputSource) &&
      !includedPaths.has(audioInputSource.path)
    ) {
      includedPaths.add(audioInputSource.path);
      args.push(
        ...audioInputSource.getInputOptions(),
        '-i',
        audioInputSource.path,
      );
    }

    if (
      !isNull(watermarkInputSource) &&
      !includedPaths.has(watermarkInputSource.path)
    ) {
      includedPaths.add(watermarkInputSource.path);
      args.push(
        ...watermarkInputSource.getInputOptions(),
        '-i',
        watermarkInputSource.path,
      );
    }

    args.push(...flatMap(stepsByType['filter'], (step) => step.options()));

    const [complexFilterSteps, otherSteps] = partition(
      stepsByType['output'],
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

const emptyStepMap = (): Record<PipelineStepType, PipelineStep[]> => ({
  filter: [],
  global: [],
  input: [],
  output: [],
});
