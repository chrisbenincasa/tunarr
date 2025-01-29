import { VideoFormats } from '@/ffmpeg/builder/constants.js';
import type { PixelFormat } from '@/ffmpeg/builder/format/PixelFormat.js';
import { RateControlMode } from '@/ffmpeg/builder/types.js';
import type { Maybe } from '@/types/util.js';
import { isDefined } from '@/util/index.js';
import { find, some } from 'lodash-es';
import { P, match } from 'ts-pattern';
import { BaseFfmpegHardwareCapabilities } from './BaseFfmpegHardwareCapabilities.ts';

export const VaapiEntrypoint = {
  Decode: 'VAEntrypointVLD',
  Encode: 'VAEntrypointEncSlice',
  EncodeLowPower: 'VAEntrypointEncSliceLP',
} as const;

export const VaapiProfiles = {
  Mpeg2Simple: 'VAProfileMPEG2Simple',
  Mpeg2Main: 'VAProfileMPEG2Main',
  H264ConstrainedBaseline: 'VAProfileH264ConstrainedBaseline',
  H264Main: 'VAProfileH264Main',
  H264High: 'VAProfileH264High',
  H264MultiviewHigh: 'VAProfileH264MultiviewHigh',
  H264StereoHigh: 'VAProfileH264StereoHigh',
  Vc1Simple: 'VAProfileVC1Simple',
  Vc1Main: 'VAProfileVC1Main',
  Vc1Advanced: 'VAProfileVC1Advanced',
  HevcMain: 'VAProfileHEVCMain',
  HevcMain10: 'VAProfileHEVCMain10',
  HevcMain12: 'VAProfileHEVCMain12',
  Vp9Profile0: 'VAProfileVP9Profile0',
  Vp9Profile1: 'VAProfileVP9Profile1',
  Vp9Profile2: 'VAProfileVP9Profile2',
  Vp9Profile3: 'VAProfileVP9Profile3',
  Av1Profile0: 'VAProfileAV1Profile0',
} as const;

export class VaapiProfileEntrypoint {
  private rateControlModes: Set<RateControlMode> = new Set();

  constructor(
    public readonly profile: string,
    public readonly entrypoint: string,
  ) {}

  hasRateControlMode(mode: RateControlMode) {
    return this.rateControlModes.has(mode);
  }

  addRateControlMode(mode: RateControlMode) {
    this.rateControlModes.add(mode);
  }
}

export class VaapiHardwareCapabilities extends BaseFfmpegHardwareCapabilities {
  readonly type: string = 'vaapi';

  constructor(private entrypoints: VaapiProfileEntrypoint[]) {
    super();
  }

  canDecode(
    videoFormat: string,
    videoProfile: Maybe<string>,
    pixelFormat: Maybe<PixelFormat>,
  ): boolean {
    const bitDepth = pixelFormat?.bitDepth ?? 8;
    return match([videoFormat, videoProfile ?? '', bitDepth])
      .with([VideoFormats.H264, P._, 10], () => false)
      .with([VideoFormats.H264, P.union('baseline', '66'), P._], () => false)
      .with([VideoFormats.H264, P.union('main', '77'), P._], () =>
        some(this.entrypoints, {
          profile: VaapiProfiles.H264Main,
          entrypoint: VaapiEntrypoint.Decode,
        }),
      )
      .with(
        [VideoFormats.H264, P.union('high', '100', 'high 10', '110'), P._],
        () =>
          some(this.entrypoints, {
            profile: VaapiProfiles.H264High,
            entrypoint: VaapiEntrypoint.Decode,
          }),
      )
      .with(
        [VideoFormats.H264, P.union('baseline constrainted', '578'), P._],
        () =>
          some(this.entrypoints, {
            profile: VaapiProfiles.H264ConstrainedBaseline,
            entrypoint: VaapiEntrypoint.Decode,
          }),
      )
      .with([VideoFormats.Mpeg2Video, P.union('main', '4'), P._], () =>
        some(this.entrypoints, {
          profile: VaapiProfiles.Mpeg2Main,
          entrypoint: VaapiEntrypoint.Decode,
        }),
      )
      .with([VideoFormats.Mpeg2Video, P.union('simple', '5'), P._], () =>
        some(this.entrypoints, {
          profile: VaapiProfiles.Mpeg2Simple,
          entrypoint: VaapiEntrypoint.Decode,
        }),
      )
      .with([VideoFormats.Vc1, P.union('simple', '0'), P._], () =>
        some(this.entrypoints, {
          profile: VaapiProfiles.Vc1Simple,
          entrypoint: VaapiEntrypoint.Decode,
        }),
      )
      .with([VideoFormats.Vc1, P.union('main', '1'), P._], () =>
        some(this.entrypoints, {
          profile: VaapiProfiles.Vc1Main,
          entrypoint: VaapiEntrypoint.Decode,
        }),
      )
      .with([VideoFormats.Vc1, P.union('advanced', '3'), P._], () =>
        some(this.entrypoints, {
          profile: VaapiProfiles.Vc1Advanced,
          entrypoint: VaapiEntrypoint.Decode,
        }),
      )
      .with([VideoFormats.Hevc, P.union('main', '1'), P._], () =>
        some(this.entrypoints, {
          profile: VaapiProfiles.HevcMain,
          entrypoint: VaapiEntrypoint.Decode,
        }),
      )
      .with([VideoFormats.Hevc, P.union('main 10', '2'), P._], () =>
        some(this.entrypoints, {
          profile: VaapiProfiles.HevcMain10,
          entrypoint: VaapiEntrypoint.Decode,
        }),
      )
      .with([VideoFormats.Vp9, P.union('profile 0', '0'), P._], () =>
        some(this.entrypoints, {
          profile: VaapiProfiles.Vp9Profile0,
          entrypoint: VaapiEntrypoint.Decode,
        }),
      )
      .with([VideoFormats.Vp9, P.union('profile 1', '1'), P._], () =>
        some(this.entrypoints, {
          profile: VaapiProfiles.Vp9Profile1,
          entrypoint: VaapiEntrypoint.Decode,
        }),
      )
      .with([VideoFormats.Vp9, P.union('profile 2', '2'), P._], () =>
        some(this.entrypoints, {
          profile: VaapiProfiles.Vp9Profile2,
          entrypoint: VaapiEntrypoint.Decode,
        }),
      )
      .with([VideoFormats.Vp9, P.union('profile 3', '3'), P._], () =>
        some(this.entrypoints, {
          profile: VaapiProfiles.Vp9Profile3,
          entrypoint: VaapiEntrypoint.Decode,
        }),
      )
      .with([VideoFormats.Av1, P.union('main', '0'), P._], () =>
        some(this.entrypoints, {
          profile: VaapiProfiles.Av1Profile0,
          entrypoint: VaapiEntrypoint.Decode,
        }),
      )
      .otherwise(() => false);
  }

  canEncode(
    videoFormat: string,
    _videoProfile: Maybe<string>,
    pixelFormat: Maybe<PixelFormat>,
  ): boolean {
    const entrypoint = this.getEncoderEntrypoint(videoFormat, pixelFormat);

    return isDefined(entrypoint);
  }

  getRateControlMode(
    videoFormat: string,
    pixelFormat: Maybe<PixelFormat>,
  ): Maybe<RateControlMode> {
    const entrypoint = this.getEncoderEntrypoint(videoFormat, pixelFormat);

    if (entrypoint) {
      if (
        entrypoint.hasRateControlMode(RateControlMode.VBR) ||
        entrypoint.hasRateControlMode(RateControlMode.CBR)
      ) {
        return;
      }

      if (entrypoint.hasRateControlMode(RateControlMode.CQP)) {
        return RateControlMode.CQP;
      }
    }

    return;
  }

  private getEncoderEntrypoint(
    videoFormat: string,
    pixelFormat: Maybe<PixelFormat>,
  ) {
    const bitDepth = pixelFormat?.bitDepth ?? 8;
    return (
      match([videoFormat, bitDepth])
        .with([VideoFormats.H264, 10], () => undefined)
        .with([VideoFormats.H264, P._], () =>
          find(
            this.entrypoints,
            (ep) =>
              ep.profile === VaapiProfiles.H264Main &&
              (ep.entrypoint === VaapiEntrypoint.Encode ||
                ep.entrypoint === VaapiEntrypoint.EncodeLowPower),
          ),
        )
        // Add support for main12 profile
        // .with([VideoFormats.Hevc, P.union(8, 10)], () =>
        //   find(
        //     this.entrypoints,
        //     (ep) =>
        //       ep.profile === VaapiProfiles.HevcMain10 &&
        //       (ep.entrypoint === VaapiEntrypoint.Encode ||
        //         ep.entrypoint === VaapiEntrypoint.EncodeLowPower),
        //   ),
        // )
        // Check for main10 specifically with 10-bit output, even though
        // HEVC main10 can support 8-10 bits. We will probably wantn to change
        // this if we start to also check profile compatibility
        // 8-bit HEVC output will be handled below.
        .with([VideoFormats.Hevc, 10], () =>
          find(
            this.entrypoints,
            (ep) =>
              ep.profile === VaapiProfiles.HevcMain10 &&
              (ep.entrypoint === VaapiEntrypoint.Encode ||
                ep.entrypoint === VaapiEntrypoint.EncodeLowPower),
          ),
        )
        .with([VideoFormats.Hevc, 8], () =>
          find(
            this.entrypoints,
            (ep) =>
              ep.profile === VaapiProfiles.HevcMain &&
              (ep.entrypoint === VaapiEntrypoint.Encode ||
                ep.entrypoint === VaapiEntrypoint.EncodeLowPower),
          ),
        )
        .with([VideoFormats.Mpeg1Video, P._], () =>
          find(
            this.entrypoints,
            (ep) =>
              ep.profile === VaapiProfiles.Mpeg2Main &&
              (ep.entrypoint === VaapiEntrypoint.Encode ||
                ep.entrypoint === VaapiEntrypoint.EncodeLowPower),
          ),
        )
        .otherwise(() => undefined)
    );
  }
}
