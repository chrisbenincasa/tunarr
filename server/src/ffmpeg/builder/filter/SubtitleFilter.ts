import { head } from 'lodash-es';
import { isWindows } from '../../../util/index.ts';
import type { SubtitlesInputSource } from '../input/SubtitlesInputSource.ts';
import type { FrameState } from '../state/FrameState.ts';
import { FrameDataLocation } from '../types.ts';
import { FilterOption } from './FilterOption.ts';

export class SubtitleFilter extends FilterOption {
  constructor(private subtitleInputSource: SubtitlesInputSource) {
    super();
  }

  get filter(): string {
    const stream = head(this.subtitleInputSource.streams);
    if (!stream) {
      return '';
    }

    let path = this.subtitleInputSource.path;

    if (isWindows()) {
      path = path.replaceAll('\\', '/\\');
    }

    if (!path.startsWith('http')) {
      path = path.replaceAll(':/', '\\\\:/');
    }

    path = path
      .replaceAll('[', '\\[')
      .replaceAll(']', '\\]')
      .replaceAll(':', '\\:');

    return `subtitles=${path}`;
  }

  nextState(currentState: FrameState): FrameState {
    return currentState.updateFrameLocation(FrameDataLocation.Software);
  }
}
