import { isEmpty } from 'lodash-es';
import type { Nullable } from '../../../types/util.ts';
import {
  ColorPrimaries,
  ColorRanges,
  ColorSpaces,
  ColorTransferFormats,
} from '../constants.ts';

type ColorFormatCtor = {
  colorRange: Nullable<string>;
  colorSpace: Nullable<string>;
  colorTransfer: Nullable<string>;
  colorPrimaries: Nullable<string>;
};
export class ColorFormat {
  readonly colorRange: Nullable<string>;
  readonly colorSpace: Nullable<string>;
  readonly colorTransfer: Nullable<string>;
  readonly colorPrimaries: Nullable<string>;

  static bt709: ColorFormat = new ColorFormat({
    colorRange: ColorRanges.Tv,
    colorSpace: ColorSpaces.Bt709,
    colorPrimaries: ColorPrimaries.Bt709,
    colorTransfer: ColorTransferFormats.Bt709,
  });

  static unknown: ColorFormat = new ColorFormat({
    colorPrimaries: null,
    colorRange: ColorRanges.Tv,
    colorSpace: null,
    colorTransfer: null,
  });

  constructor(params: ColorFormatCtor) {
    this.colorPrimaries = params.colorPrimaries;
    this.colorRange = params.colorRange;
    this.colorSpace = params.colorSpace;
    this.colorTransfer = params.colorTransfer;
  }

  get isHdr() {
    return (
      this.colorTransfer === ColorTransferFormats.Smpte2084 ||
      this.colorTransfer === ColorTransferFormats.AribStdB67
    );
  }

  get isBt709() {
    return (
      this.colorRange === ColorRanges.Tv &&
      this.colorSpace === ColorSpaces.Bt709 &&
      (isEmpty(this.colorTransfer) ||
        this.colorTransfer === ColorTransferFormats.Bt709) &&
      (isEmpty(this.colorPrimaries) ||
        this.colorPrimaries === ColorPrimaries.Bt709)
    );
  }
}
