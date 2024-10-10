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
import { FilterChain } from './FilterChain';

export class ComplexFilter implements Option {
  readonly type = 'filter';
  constructor(
    private videoInputSource: VideoInputSource,
    private audioInputSource: Nullable<AudioInputSource>,
    private watermarkInputSource: Nullable<WatermarkInputSource>,
    private filterChain: FilterChain,
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
    let watermarkOverlayFilterComplex = '';

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
          .map((step) => step.filter)
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
          .map((step) => step.filter)
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

    if (
      isNonEmptyString(watermarkLabel) &&
      this.filterChain.watermarkOverlayFilterSteps.length > 0
    ) {
      const filterString = _.chain(this.filterChain.watermarkOverlayFilterSteps)
        .map((step) => step.filter)
        .filter(isNonEmptyString)
        .join(',')
        .value();
      watermarkOverlayFilterComplex += `${formatLabel(videoLabel)}${formatLabel(
        watermarkLabel,
      )}${filterString}`;
      videoLabel = '[vwm]';
      watermarkOverlayFilterComplex += videoLabel;
    }

    ifDefined(this.audioInputSource, (audioInput) => {
      const audioInputIndex = distinctPaths.indexOf(audioInput.path);
      if (audioInputIndex === -1) {
        return;
      }

      forEach(audioInput.audioStreams, (stream) => {
        const index = stream.index;
        audioLabel = `${audioInputIndex}:${index}`;
        if (
          some(audioInput.filterSteps, (step) => isNonEmptyString(step.filter))
        ) {
          audioFilterComplex += `[${audioInputIndex}:${index}]`;
          audioFilterComplex += _.chain(audioInput.filterSteps)
            .map((step) => step.filter)
            .filter(isNonEmptyString)
            .join(',')
            .value();
          audioLabel = '[a]';
          audioFilterComplex += audioLabel;
        }
      });
    });

    let pixelFormatFilterComplex = '';
    if (this.filterChain.pixelFormatFilterSteps.length > 0) {
      pixelFormatFilterComplex += `${formatLabel(videoLabel)}`;
      pixelFormatFilterComplex += _.chain(
        this.filterChain.pixelFormatFilterSteps,
      )
        .map((step) => step.filter)
        .filter(isNonEmptyString)
        .join(',')
        .value();
      videoLabel = '[vpf]';
      pixelFormatFilterComplex += videoLabel;
    }

    const filterComplex = _.chain([
      videoFilterComplex,
      audioFilterComplex,
      watermarkFilterComplex,
      watermarkOverlayFilterComplex,
      pixelFormatFilterComplex,
    ])
      .tap(console.log)
      .filter(isNonEmptyString)
      .join(';')
      .value();

    if (isNonEmptyString(filterComplex)) {
      result.push('-filter_complex', filterComplex);
    }

    result.push('-map', videoLabel, '-map', audioLabel);

    return result;
  }
}

function formatLabel(label: string) {
  return label.startsWith('[') ? label : `[${label}]`;
}
