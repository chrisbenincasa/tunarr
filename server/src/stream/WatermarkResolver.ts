import type { StreamLineupItem } from '@/db/derived_types/StreamLineup.js';
import type { ChannelOrm } from '@/db/schema/Channel.js';
import type { TranscodeConfigOrm } from '@/db/schema/TranscodeConfig.js';
import { CacheImageService } from '@/services/cacheImageService.js';
import type { Maybe } from '@/types/util.js';
import { resolveIconUrl } from '@/util/iconUtil.js';
import { attempt, isNonEmptyString, isSuccess } from '@/util/index.js';
import { makeLocalUrl } from '@/util/serverUtil.js';
import type { Watermark } from '@tunarr/types';
import { inject, injectable } from 'inversify';

/**
 * Decides which watermark, if any, a lineup item plays with.
 *
 * Both streaming backends use this, so the overlay switches, the image cache
 * and the channel-icon fallback behave the same on either.
 */
@injectable()
export class WatermarkResolver {
  constructor(
    @inject(CacheImageService) private cacheImageService: CacheImageService,
  ) {}

  /**
   * @param channel The channel whose schedule is playing. For a redirect this
   *   is the redirect target, not the tuned channel.
   * @returns The watermark with `url` resolved to a cached file path or a URL,
   *   or undefined when the item plays without one.
   */
  async resolve({
    channel,
    transcodeConfig,
    lineupItem,
  }: {
    channel: Pick<ChannelOrm, 'watermark' | 'icon' | 'disableFillerOverlay'>;
    transcodeConfig: Pick<TranscodeConfigOrm, 'disableChannelOverlay'>;
    lineupItem: Pick<StreamLineupItem, 'type'>;
  }): Promise<Maybe<Watermark>> {
    if (transcodeConfig.disableChannelOverlay) {
      return;
    }

    if (lineupItem.type === 'commercial' && channel.disableFillerOverlay) {
      return;
    }

    if (!channel.watermark?.enabled) {
      return;
    }

    const watermark = { ...channel.watermark };
    const watermarkUrl = watermark.url;
    let icon: string;

    if (isNonEmptyString(watermarkUrl) && URL.canParse(watermarkUrl)) {
      const parsed = new URL(watermarkUrl);
      if (parsed.host.includes('localhost')) {
        icon = watermarkUrl;
      } else {
        const cached = await attempt(() =>
          this.cacheImageService.getOrDownloadImageUrl(watermarkUrl),
        );

        icon =
          isSuccess(cached) && isNonEmptyString(cached?.path)
            ? cached.path
            : makeLocalUrl('/images/tunarr.png');
      }
    } else {
      const resolvedIcon = resolveIconUrl(
        channel.icon,
        makeLocalUrl('/images/tunarr.png'),
      );
      if (!resolvedIcon) {
        return;
      }
      icon = resolvedIcon;
    }

    return {
      ...watermark,
      enabled: true,
      url: icon,
    };
  }
}
