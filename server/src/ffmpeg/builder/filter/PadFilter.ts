import { HardwareDownloadFilter } from '@/ffmpeg/builder/filter/HardwareDownloadFilter.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import type { FrameSize } from '@/ffmpeg/builder/types.js';
import { FrameDataLocation } from '@/ffmpeg/builder/types.js';
import { isNonEmptyString } from '@/util/index.js';
import { HardwareAccelerationMode } from '../../../db/schema/TranscodeConfig.js';
import type { Nullable } from '../../../types/util.ts';
import { FilterOption } from './FilterOption.ts';
import { HardwareDownloadCudaFilter } from './nvidia/HardwareDownloadCudaFilter.ts';

export class PadFilter extends FilterOption {
  private desiredPaddedSize: FrameSize;
  private hwDownloadFilter: FilterOption;

  public readonly filter: string;
  public readonly affectsFrameState: boolean = true;

  constructor(
    decoderHwAccelMode: Nullable<HardwareAccelerationMode>,
    private currentState: FrameState,
    desiredState: FrameState,
  ) {
    super();
    this.desiredPaddedSize = desiredState.paddedSize;
    this.hwDownloadFilter =
      decoderHwAccelMode === HardwareAccelerationMode.Cuda
        ? new HardwareDownloadCudaFilter(this.currentState, null)
        : new HardwareDownloadFilter(this.currentState);
    this.filter = this.generateFilter();
  }

  static create(currentState: FrameState, desiredState: FrameState) {
    return new PadFilter(null, currentState, desiredState);
  }

  static forCuda(currentState: FrameState, desiredState: FrameState) {
    return new PadFilter(
      HardwareAccelerationMode.Cuda,
      currentState,
      desiredState,
    );
  }

  nextState(currentState: FrameState): FrameState {
    return this.hwDownloadFilter.nextState(currentState).update({
      paddedSize: this.desiredPaddedSize,
      frameDataLocation: FrameDataLocation.Software,
    });
  }

  private generateFilter(): string {
    const pad = `pad=${this.desiredPaddedSize.width}:${this.desiredPaddedSize.height}:-1:-1:color=black`;
    const hwDownloadPart = this.hwDownloadFilter.filter;

    if (isNonEmptyString(hwDownloadPart)) {
      return `${hwDownloadPart},${pad}`;
    }

    return pad;
  }
}
