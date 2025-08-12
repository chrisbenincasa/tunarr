import type { Channel } from '@/db/schema/Channel.js';
import { ChannelCache } from '@/stream/ChannelCache.js';
import type { Maybe } from '@/types/util.js';
import { random } from '@/util/random.js';
import constants from '@tunarr/shared/constants';
import { inject, injectable } from 'inversify';
import { isEmpty, isNil } from 'lodash-es';
import type {
  ChannelFillerShowWithContent,
  ProgramWithRelations,
} from '../db/schema/derivedTypes.js';
import type { IFillerPicker } from './interfaces/IFillerPicker.ts';
import { EmptyFillerPickResult } from './interfaces/IFillerPicker.ts';

const DefaultFillerCooldownMillis = 30 * 60 * 1000;
const OneDayMillis = 7 * 24 * 60 * 60 * 1000;
const FiveMinutesMillis = 5 * 60 * 60 * 1000;

@injectable()
export class FillerPicker implements IFillerPicker {
  #channelCache: ChannelCache;

  constructor(@inject(ChannelCache) channelCache: ChannelCache) {
    this.#channelCache = channelCache;
  }

  pickFiller(
    channel: Channel,
    fillers: ChannelFillerShowWithContent[],
    maxDuration: number,
  ) {
    if (isEmpty(fillers)) {
      return EmptyFillerPickResult;
    }

    let pick1: Maybe<ProgramWithRelations>;
    const t0 = new Date().getTime();
    let minimumWait = 1000000000;

    const fillerRepeatCooldownMs =
      channel.fillerRepeatCooldown ?? DefaultFillerCooldownMillis;

    let listM = 0;
    let fillerListId: Maybe<string>;
    for (const filler of fillers) {
      const fillerPrograms = filler.fillerContent;
      let pickedList = false;
      let n = 0;

      for (const clip of fillerPrograms) {
        // a few extra milliseconds won't hurt anyone, would it? dun dun dun
        if (clip.duration <= maxDuration + constants.SLACK) {
          const t1 = this.#channelCache.getProgramLastPlayTime(
            channel.uuid,
            clip.uuid,
          );
          let timeSince = t1 == 0 ? OneDayMillis : t0 - t1;

          if (timeSince < fillerRepeatCooldownMs - constants.SLACK) {
            const w = fillerRepeatCooldownMs - timeSince;
            if (clip.duration + w <= maxDuration + constants.SLACK) {
              minimumWait = Math.min(minimumWait, w);
            }
            timeSince = 0;
            //30 minutes is too little, don't repeat it at all
          } else if (!pickedList) {
            const t1 = this.#channelCache.getFillerLastPlayTime(
              channel.uuid,
              filler.fillerShow.uuid,
            );
            const timeSince = t1 == 0 ? OneDayMillis : t0 - t1;
            if (timeSince + constants.SLACK >= filler.cooldown) {
              //should we pick this list?
              listM += filler.weight;
              if (random.bool(filler.weight, listM)) {
                pickedList = true;
                fillerListId = filler.fillerShow.uuid;
                n = 0;
              } else {
                break;
              }
            } else {
              const w = filler.cooldown - timeSince;
              if (clip.duration + w <= maxDuration + constants.SLACK) {
                minimumWait = Math.min(minimumWait, w);
              }

              break;
            }
          }
          if (timeSince <= 0) {
            continue;
          }
          const s = norm_s(
            timeSince >= FiveMinutesMillis ? FiveMinutesMillis : timeSince,
          );
          const d = norm_d(clip.duration);
          const w = s + d;
          n += w;
          if (random.bool(w, n)) {
            pick1 = clip;
          }
        }
      }
    }

    return {
      fillerListId: fillerListId!,
      filler: isNil(pick1) ? null : pick1,
      minimumWait,
    };
  }
}

function norm_d(x: number) {
  x /= 60 * 1000;
  if (x >= 3.0) {
    x = 3.0 + Math.log(x);
  }
  const y = 10000 * (Math.ceil(x * 1000) + 1);
  return Math.ceil(y / 1000000) + 1;
}

function norm_s(x: number) {
  let y = Math.ceil(x / 600) + 1;
  y = y * y;
  return Math.ceil(y / 1000000) + 1;
}
