import _, { constant, forEach, identity, isNull, some } from 'lodash-es';
import { Nullable } from '../../../types/util';
import { AudioInputFile, PipelineStep, VideoInputFile } from '../types';
import { FilterChain } from './FilterChain';
import { ifDefined, isNonEmptyString } from '../../../util';

export class ComplexFilter implements PipelineStep {
  constructor(
    private videoInputFile: VideoInputFile,
    private audioInputFile: Nullable<AudioInputFile>,
    private filterChain: FilterChain,
  ) {}

  nextState = identity;
  globalOptions = constant([]);
  inputOptions = constant([]);
  outputOptions = constant([]);
  filterOptions(): string[] {
    let audioLabel = '0:a';
    let videoLabel = '0:v';
    const result: string[] = [];
    const distinctPaths: string[] = [this.videoInputFile.path];

    if (!isNull(this.audioInputFile)) {
      // TODO: use audio as a separate input with vaapi/qsv
      if (!distinctPaths.includes(this.audioInputFile.path)) {
        distinctPaths.push(this.audioInputFile.path);
      }
    }

    // Consider using arrays here.
    let videoFilterComplex = '';
    let audioFilterComplex = '';

    const videoInputIndex = distinctPaths.indexOf(this.videoInputFile.path);
    forEach(this.videoInputFile.videoStreams, (stream) => {
      const index = stream.index;
      videoLabel = `${videoInputIndex}:${index}`;
      if (
        some(this.filterChain.videoFilterSteps, (step) =>
          isNonEmptyString(step.filter),
        )
      ) {
        videoFilterComplex += `[${videoInputIndex}:${index}]`;
        const filters = _.chain(this.filterChain.videoFilterSteps)
          .map('filter')
          .filter(isNonEmptyString)
          .join(',')
          .value();
        videoFilterComplex += filters;
        videoLabel = '[v]';
        videoFilterComplex += videoLabel;
      }
    });

    ifDefined(this.audioInputFile, (audioInput) => {
      const audioInputIndex = distinctPaths.indexOf(audioInput.path);
      forEach(audioInput.audioStreams, (stream) => {
        const index = stream.index;
        audioLabel = `${audioInputIndex}:${index}`;
        if (
          some(audioInput.filterSteps, (step) => isNonEmptyString(step.filter))
        ) {
          audioFilterComplex += `[${audioFilterComplex}:${index}]`;
          audioFilterComplex += _.chain(audioInput.filterSteps)
            .filter(isNonEmptyString)
            .map('filter')
            .join(',')
            .value();
          audioLabel = '[a]';
          audioFilterComplex += audioLabel;
        }
      });
    });

    const filterComplex = _.chain([videoFilterComplex])
      .filter(isNonEmptyString)
      .join(',')
      .value();

    if (isNonEmptyString(filterComplex)) {
      result.push('-filter_complex', filterComplex);
    }

    result.push('-map', audioLabel, '-map', videoLabel);

    return result;
  }
}
