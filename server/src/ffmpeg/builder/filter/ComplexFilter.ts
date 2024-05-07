import _, { forEach, isNull, some } from 'lodash-es';
import { Nullable } from '../../../types/util';
import { ifDefined, isNonEmptyString } from '../../../util';
import { Option } from '../options/Option';
import {
  AudioInputSource,
  VideoInputSource,
  WatermarkInputSource,
} from '../types';
import { FrameState } from '../state/FrameState.js';

export class ComplexFilter implements Option {
  readonly type = 'filter';
  constructor(
    private videoInputSource: VideoInputSource,
    private audioInputSource: Nullable<AudioInputSource>,
    private watermarkInputSource: Nullable<WatermarkInputSource>,
  ) {}

  readonly affectsFrameState: boolean = false;

  nextState(currentState: FrameState): FrameState {
    return currentState;
  }

  options(): string[] {
    let audioLabel = '0:a';
    let videoLabel = '0:v';
    let watermarkLabel: Nullable<string> = null;
    const result: string[] = [];
    const distinctPaths: string[] = [this.videoInputSource.path];

    if (!isNull(this.audioInputSource)) {
      // TODO: use audio as a separate input with vaapi/qsv
      if (!distinctPaths.includes(this.audioInputSource.path)) {
        distinctPaths.push(this.audioInputSource.path);
      }
    }

    ifDefined(this.watermarkInputSource, (watermark) => {
      if (!distinctPaths.includes(watermark.path)) {
        distinctPaths.push(watermark.path);
      }
    });

    // Consider using arrays here.
    let videoFilterComplex = '';
    let audioFilterComplex = '';
    let watermarkFilterComplex = '';

    const videoInputIndex = distinctPaths.indexOf(this.videoInputSource.path);
    forEach(this.videoInputSource.videoStreams, (stream) => {
      const index = stream.index;
      videoLabel = `${videoInputIndex}:${index}`;
      if (
        some(this.videoInputSource.filterSteps, (step) =>
          isNonEmptyString(step.filter),
        )
      ) {
        videoFilterComplex += `[${videoInputIndex}:${index}]`;
        const filters = _.chain(this.videoInputSource.filterSteps)
          .map('filter')
          .filter(isNonEmptyString)
          .join(',')
          .value();
        videoFilterComplex += filters;
        videoLabel = '[v]';
        videoFilterComplex += videoLabel;
      }
    });

    ifDefined(this.watermarkInputSource, (watermark) => {
      const inputIndex = distinctPaths.indexOf(watermark.path);
      forEach(watermark.videoStreams, (_1, index) => {
        watermarkLabel = `${inputIndex}:${index}`;
        const filterSteps = _.chain(watermark.filterSteps)
          .map('filter')
          .filter(isNonEmptyString)
          .value();
        if (filterSteps.length > 0) {
          watermarkLabel = '[wm]';
          watermarkFilterComplex += `[${inputIndex}:${index}]${filterSteps.join(
            ',',
          )}${watermarkLabel}`;
        } else {
          watermarkLabel = `[${watermarkLabel}]`;
        }
      });
    });

    if (isNonEmptyString(watermarkLabel))
      ifDefined(this.audioInputSource, (audioInput) => {
        const audioInputIndex = distinctPaths.indexOf(audioInput.path);
        forEach(audioInput.audioStreams, (stream) => {
          const index = stream.index;
          audioLabel = `${audioInputIndex}:${index}`;
          if (
            some(audioInput.filterSteps, (step) =>
              isNonEmptyString(step.filter),
            )
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

  private formatLabel(label: string) {
    return label.startsWith('[') ? label : `[${label}]`;
  }
}
