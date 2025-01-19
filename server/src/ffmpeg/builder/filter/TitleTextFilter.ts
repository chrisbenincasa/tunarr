import { FrameSize } from '@/ffmpeg/builder/types.js';
import { serverOptions } from '@/globals.js';
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
    return `drawtext=fontfile=${
      serverOptions().databaseDirectory
    }/font.ttf:fontsize=${sz1}:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:text='${
      this.title
    }',drawtext=fontfile=${
      serverOptions().databaseDirectory
    }/font.ttf:fontsize=${sz2}:fontcolor=white:x=(w-text_w)/2:y=(h+text_h+${sz3})/2:text='${
      this.subtitle ?? ''
    }'`;
  }
}
