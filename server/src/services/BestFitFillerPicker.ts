import type { Channel } from '@/db/schema/Channel.js';
import { ChannelCache } from '@/stream/ChannelCache.js';
import type { Maybe } from '@/types/util.js';
import { random } from '@/util/random.js';
import constants from '@tunarr/shared/constants';
import dayjs from 'dayjs';
import { injectable } from 'inversify';
import { isEmpty, isNil } from 'lodash-es';
import type {
  ChannelFillerShowWithContent,
  ProgramWithRelations,
} from '../db/schema/derivedTypes.js';
import {
  EmptyFillerPickResult,
  IFillerPicker,
} from './interfaces/IFillerPicker.ts';

const DefaultFillerCooldownMillis = 30 * 60 * 1000;
const OneDayMillis = 7 * 24 * 60 * 60 * 1000;
const FiveMinutesMillis = 5 * 60 * 60 * 1000;

@injectable()
export class BestFitFillerPicker implements IFillerPicker {
  #channelCache: ChannelCache;

  constructor(channelCache: ChannelCache) {
    this.#channelCache = channelCache;
  }

  pickFiller(
    channel: Channel,
    channelFillerLists: ChannelFillerShowWithContent[],
    maxDuration: number,
  ) {
    if (isEmpty(channelFillerLists)) {
      return EmptyFillerPickResult;
    }

    let pick1: Maybe<ProgramWithRelations>;
    const now = +dayjs();
    let minimumWait = Number.MAX_SAFE_INTEGER;

    const fillerRepeatCooldownMs =
      channel.fillerRepeatCooldown ?? DefaultFillerCooldownMillis;

    let listPickWeight = 0;
    let fillerId: Maybe<string>;

    let minUntilFillerListAvailable = Number.MAX_SAFE_INTEGER;
    const listsNotInCooldown = channelFillerLists.filter(
      ({ cooldown, fillerShowUuid }) => {
        const fillerListLastPlayed = this.#channelCache.getFillerLastPlayTime(
          channel.uuid,
          fillerShowUuid,
        );
        minUntilFillerListAvailable = Math.min(
          minUntilFillerListAvailable,
          fillerListLastPlayed,
        );
        const timeSince =
          fillerListLastPlayed === 0
            ? OneDayMillis
            : now - fillerListLastPlayed;
        return timeSince < cooldown + constants.SLACK;
      },
    );

    if (listsNotInCooldown.length === 0) {
      return EmptyFillerPickResult;
    }

    for (const viableList of listsNotInCooldown) {
      // @ts-expect-error - WIP
      const _viablePrograms = viableList.fillerContent.filter((program) => {
        if (program.duration > maxDuration + constants.SLACK) {
          return false;
        }

        const lastPlayedTime = this.#channelCache.getProgramLastPlayTime(
          channel.uuid,
          program.uuid,
        );

        // @ts-expect-error - WIP
        const _timeSinceLastPlayed =
          lastPlayedTime === 0 ? OneDayMillis : now - lastPlayedTime;
      });
    }

    for (const channelFillerList of channelFillerLists) {
      const fillerPrograms = channelFillerList.fillerContent;
      let pickedList = false;
      let n = 0;

      for (const fillerProgram of fillerPrograms) {
        // a few extra milliseconds won't hurt anyone, would it? dun dun dun
        if (fillerProgram.duration <= maxDuration + constants.SLACK) {
          const lastPlayedTime = this.#channelCache.getProgramLastPlayTime(
            channel.uuid,
            fillerProgram.uuid,
          );

          let timeSinceLastPlayed =
            lastPlayedTime === 0 ? OneDayMillis : now - lastPlayedTime;

          if (timeSinceLastPlayed < fillerRepeatCooldownMs - constants.SLACK) {
            const w = fillerRepeatCooldownMs - timeSinceLastPlayed;
            if (fillerProgram.duration + w <= maxDuration + constants.SLACK) {
              minimumWait = Math.min(minimumWait, w);
            }
            timeSinceLastPlayed = 0;
            //30 minutes is too little, don't repeat it at all
          } else if (!pickedList) {
            const fillerListLastPlayed =
              this.#channelCache.getFillerLastPlayTime(
                channel.uuid,
                channelFillerList.fillerShow.uuid,
              );
            const timeSince =
              fillerListLastPlayed === 0
                ? OneDayMillis
                : now - fillerListLastPlayed;
            if (timeSince + constants.SLACK >= channelFillerList.cooldown) {
              //should we pick this list?
              listPickWeight += channelFillerList.weight;
              if (random.bool(channelFillerList.weight, listPickWeight)) {
                pickedList = true;
                fillerId = channelFillerList.fillerShow.uuid;
                n = 0;
              } else {
                break;
              }
            } else {
              const w = channelFillerList.cooldown - timeSince;
              if (fillerProgram.duration + w <= maxDuration + constants.SLACK) {
                minimumWait = Math.min(minimumWait, w);
              }

              break;
            }
          }

          if (timeSinceLastPlayed <= 0) {
            continue;
          }

          const s = norm_s(
            timeSinceLastPlayed >= FiveMinutesMillis
              ? FiveMinutesMillis
              : timeSinceLastPlayed,
          );
          const d = norm_d(fillerProgram.duration);
          const w = s + d;
          n += w;
          if (random.bool(w, n)) {
            pick1 = fillerProgram;
          }
        }
      }
    }

    return {
      fillerListId: fillerId!,
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
