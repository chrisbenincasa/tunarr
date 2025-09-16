import type { AudioInputSource } from '@/ffmpeg/builder/input/AudioInputSource.js';
import type { VideoInputSource } from '@/ffmpeg/builder/input/VideoInputSource.js';
import type { WatermarkInputSource } from '@/ffmpeg/builder/input/WatermarkInputSource.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import type { Nullable } from '@/types/util.js';
import { ifDefined, isNonEmptyString } from '@/util/index.js';
import { seq } from '@tunarr/shared/util';
import { filter, forEach, isNull, some } from 'lodash-es';
import type { SubtitlesInputSource } from '../input/SubtitlesInputSource.ts';
import { SubtitleMethods } from '../MediaStream.ts';
import type {
  FilterOptionPipelineStep,
  HasFilterOption,
} from '../types/PipelineStep.ts';
import type { FilterChain } from './FilterChain.ts';

export class ComplexFilter implements FilterOptionPipelineStep {
  readonly type = 'filter';

  constructor(
    private videoInputSource: VideoInputSource,
    private audioInputSource: Nullable<AudioInputSource>,
    private subtitleInputSource: Nullable<SubtitlesInputSource>,
    private watermarkInputSource: Nullable<WatermarkInputSource>,
    public readonly filterChain: FilterChain,
  ) {}

  readonly affectsFrameState: boolean = false;

  nextState(currentState: FrameState): FrameState {
    return currentState;
  }

  options(): string[] {
    let audioLabel = '0:a';
    let videoLabel = '0:v';
    let watermarkLabel: Nullable<string> = null;
    let subtitleLabel: Nullable<string> = null;
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

    ifDefined(this.subtitleInputSource, (subtitle) => {
      if (!distinctPaths.includes(subtitle.path)) {
        distinctPaths.push(subtitle.path);
      }
    });

    // Consider using arrays here.
    let videoFilterComplex = '';
    let audioFilterComplex = '';
    let watermarkFilterComplex = '';
    let watermarkOverlayFilterComplex = '';
    let subtitleFilterComplex = '';
    let subtitleOverlayFilterComplex = '';

    const videoInputIndex = distinctPaths.indexOf(this.videoInputSource.path);
    forEach(this.videoInputSource.streams, (stream) => {
      const index = stream.index;
      videoLabel = `${videoInputIndex}:${index}`;
      if (
        some(this.videoInputSource.filterSteps, (step) =>
          isNonEmptyString(step.filter),
        )
      ) {
        videoFilterComplex += `[${videoInputIndex}:${index}]`;

        const filters = collectSteps(this.videoInputSource.filterSteps).join(
          ',',
        );

        videoFilterComplex += filters;
        videoLabel = '[v]';
        videoFilterComplex += videoLabel;
      }
    });

    ifDefined(this.watermarkInputSource, (watermark) => {
      const inputIndex = distinctPaths.indexOf(watermark.path);
      forEach(watermark.streams, (_1, index) => {
        watermarkLabel = `${inputIndex}:${index}`;
        const filterSteps = collectSteps(watermark.filterSteps);
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

    ifDefined(this.subtitleInputSource, (subtitle) => {
      if (subtitle.method !== SubtitleMethods.Burn) {
        return;
      }

      const inputIndex = distinctPaths.indexOf(subtitle.path);
      subtitle.streams.forEach((stream) => {
        subtitleLabel = `${inputIndex}:${stream.index}`;
        const filterSteps = collectSteps(subtitle.filterSteps);
        if (filterSteps.length > 0) {
          subtitleLabel = '[sub]';
          subtitleFilterComplex += `[${inputIndex}:${stream.index}]${filterSteps.join(',')}${subtitleLabel}`;
        } else {
          subtitleLabel = `[${subtitleLabel}]`;
        }
      });
    });

    // Overlay subtitles first
    if (
      isNonEmptyString(subtitleLabel) &&
      this.filterChain.subtitleOverlayFilterSteps.length > 0
    ) {
      const filterString = collectAndJoinSteps(
        this.filterChain.subtitleOverlayFilterSteps,
      );
      subtitleOverlayFilterComplex += `${formatLabel(videoLabel)}${formatLabel(
        subtitleLabel,
      )}${filterString}`;
      videoLabel = '[vsub]';
      subtitleOverlayFilterComplex += videoLabel;
    }

    // Then watermarks
    if (
      isNonEmptyString(watermarkLabel) &&
      this.filterChain.watermarkOverlayFilterSteps.length > 0
    ) {
      const filterString = collectAndJoinSteps(
        this.filterChain.watermarkOverlayFilterSteps,
      );
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

      forEach(audioInput.streams, (stream) => {
        const index = stream.index;
        audioLabel = `${audioInputIndex}:${index}`;
        if (
          some(audioInput.filterSteps, (step) => isNonEmptyString(step.filter))
        ) {
          audioFilterComplex += `[${audioInputIndex}:${index}]`;
          audioFilterComplex += collectAndJoinSteps(audioInput.filterSteps);
          audioLabel = '[a]';
          audioFilterComplex += audioLabel;
        }
      });
    });

    let pixelFormatFilterComplex = '';
    if (this.filterChain.pixelFormatFilterSteps.length > 0) {
      pixelFormatFilterComplex += `${formatLabel(videoLabel)}`;
      pixelFormatFilterComplex += collectAndJoinSteps(
        this.filterChain.pixelFormatFilterSteps,
      );
      videoLabel = '[vpf]';
      pixelFormatFilterComplex += videoLabel;
    }

    const allFilters = [
      videoFilterComplex,
      audioFilterComplex,
      subtitleFilterComplex,
      watermarkFilterComplex,
      subtitleOverlayFilterComplex,
      watermarkOverlayFilterComplex,
      pixelFormatFilterComplex,
    ];
    const filterComplex = filter(allFilters, isNonEmptyString).join(';');

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

function collectSteps(steps: HasFilterOption[]) {
  return seq.collect(steps, (step) => {
    if (isNonEmptyString(step.filter)) {
      return step.filter;
    }
    return;
  });
}

function collectAndJoinSteps(steps: HasFilterOption[]) {
  return collectSteps(steps).join(',');
}
