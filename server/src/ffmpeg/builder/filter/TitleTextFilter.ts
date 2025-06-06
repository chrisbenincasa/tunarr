import type { FrameSize } from '@/ffmpeg/builder/types.js';
import { serverOptions } from '@/globals.js';
import path from 'node:path';
import { isWindows } from '../../../util/index.ts';
import { FilterOption } from './FilterOption.ts';

export class TitleTextFilter extends FilterOption {
  constructor(
    private size: FrameSize,
    private title: string,
    private subtitle?: string,
  ) {
    super();
  }

  get filter() {
    const sz2 = Math.ceil(this.size.height / 33);
    const sz1 = Math.ceil((sz2 * 3) / 2);
    const sz3 = 2 * sz2;
    let fontPath = path
      .join(serverOptions().databaseDirectory, 'font.ttf')
      .replaceAll(':', '\\:');
    if (isWindows()) {
      // Just use forward slashes on windows. ffmpeg (and windows) can handle it.
      fontPath = fontPath.replaceAll(path.win32.sep, path.posix.sep);
    }

    return `drawtext=fontfile=${fontPath}:fontsize=${sz1}:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:text='${
      this.title
    }',drawtext=fontfile=${fontPath}:fontsize=${sz2}:fontcolor=white:x=(w-text_w)/2:y=(h+text_h+${sz3})/2:text='${
      this.subtitle ?? ''
    }'`;
  }
}
