import { EntityDTO, Loaded } from '@mikro-orm/core';
import constants from '@tunarr/shared/constants';
import { isEmpty, isNil, isUndefined } from 'lodash-es';
import { ChannelCache } from '../stream/ChannelCache';
import { Channel } from '../dao/entities/Channel';
import { ChannelFillerShow } from '../dao/entities/ChannelFillerShow';
import { Program } from '../dao/entities/Program';
import { Nullable } from '../types/util';
import { Maybe } from '../types/util';
import { random } from '../util/random';

const DefaultFillerCooldownMillis = 30 * 60 * 1000;
const OneDayMillis = 7 * 24 * 60 * 60 * 1000;
const FiveMinutesMillis = 5 * 60 * 60 * 1000;

export class FillerPicker {
  #channelCache: ChannelCache;

  constructor(channelCache: ChannelCache = new ChannelCache()) {
    this.#channelCache = channelCache;
  }

  pickRandomWithMaxDuration(
    channel: Loaded<Channel>,
    fillers: Loaded<ChannelFillerShow, 'fillerShow' | 'fillerShow.content'>[],
    maxDuration: number,
  ): {
    fillerId: Nullable<string>;
    filler: Nullable<EntityDTO<Program>>;
    minimumWait: number;
  } {
    if (isEmpty(fillers)) {
      return {
        fillerId: null,
        filler: null,
        minimumWait: Number.MAX_SAFE_INTEGER,
      };
    }

    let pick1: Maybe<EntityDTO<Loaded<Program, never>>>;
    const t0 = new Date().getTime();
    let minimumWait = 1000000000;

    let fillerRepeatCooldownMs = 0;
    if (isUndefined(channel.fillerRepeatCooldown)) {
      fillerRepeatCooldownMs = DefaultFillerCooldownMillis;
    }

    let listM = 0;
    let fillerId: Maybe<string>;
    for (const filler of fillers) {
      const fillerPrograms = filler.fillerShow.content.$.toArray();
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
                fillerId = filler.fillerShow.uuid;
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
      fillerId: fillerId!,
      filler: isNil(pick1)
        ? null
        : {
            ...pick1,
            duration: pick1.duration,
          },
      minimumWait: minimumWait,
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
