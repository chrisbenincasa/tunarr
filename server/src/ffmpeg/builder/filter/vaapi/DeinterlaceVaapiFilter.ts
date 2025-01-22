import { FilterOption } from '@/ffmpeg/builder/filter/FilterOption.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';

export class DeinterlaceVaapiFilter extends FilterOption {
  public get filter(): string {
    return this.currentState.frameDataLocation === 'hardware'
      ? 'deinterlace_vaapi'
      : 'format=nv12|p010le|vaapi,hwupload,deinterlace_vaapi';
  }

  constructor(private currentState: FrameState) {
    super();
  }

  public readonly affectsFrameState: boolean = true;

  nextState(currentState: FrameState): FrameState {
    return currentState.update({
      deinterlace: true,
      frameDataLocation: 'hardware',
    });
  }
}
