import { head } from 'lodash-es';
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

    // FFmpeg parses the subtitle option, then parses the containing filtergraph.
    // Escape both layers in order. The filtergraph is passed directly to ffmpeg,
    // so there is no shell-escaping layer.
    let path = this.subtitleInputSource.path
      .replaceAll('\\', '\\\\')
      .replaceAll("'", "\\'")
      .replaceAll(':', '\\:')
      .replaceAll('=', '\\=');

    path = path
      .replaceAll('\\', '\\\\')
      .replaceAll("'", "\\'")
      .replaceAll('[', '\\[')
      .replaceAll(']', '\\]')
      .replaceAll(',', '\\,')
      .replaceAll(';', '\\;');

    return `subtitles=${path}`;
  }

  nextState(currentState: FrameState): FrameState {
    return currentState.updateFrameLocation(FrameDataLocation.Software);
  }
}
