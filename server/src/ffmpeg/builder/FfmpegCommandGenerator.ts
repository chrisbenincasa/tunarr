import { findIndex, first, flatMap, partition } from 'lodash-es';
import { PipelineStep, VideoInputFile } from './types';
import { ComplexFilter } from './filter/ComplexFilter';
import { ifDefined } from '../../util';
import { BaseEncoder } from './encoder/BaseEncoder';

export class FfmpegCommandGenerator {
  generateArgs(
    videoInputFile: VideoInputFile,
    steps: PipelineStep[],
  ): string[] {
    const args: string[] = [...flatMap(steps, (step) => step.globalOptions())];

    // const includedPaths = new Set<string>([videoInputFile.path]);

    args.push(...videoInputFile.getInputOptions(), '-i', videoInputFile.path);
    args.push(...flatMap(steps, (step) => step.filterOptions()));

    const [complexFilterSteps, otherSteps] = partition(
      steps,
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

    args.push(...flatMap(sortedSteps, (step) => step.outputOptions()));

    return args;
  }
}
