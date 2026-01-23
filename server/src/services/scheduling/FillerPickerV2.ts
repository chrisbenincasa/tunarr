import dayjs from 'dayjs';
import { inject, injectable } from 'inversify';
import { groupBy, isEmpty, maxBy, sumBy } from 'lodash-es';
import { ProgramPlayHistoryDB } from '../../db/ProgramPlayHistoryDB.ts';
import { Channel } from '../../db/schema/Channel.ts';
import { ChannelFillerShowWithContent } from '../../db/schema/derivedTypes.ts';
import {
  FiveMinutesMillis,
  OneDayMillis,
} from '../../ffmpeg/builder/constants.ts';
import { KEYS } from '../../types/inject.ts';
import { Maybe } from '../../types/util.ts';
import { Logger } from '../../util/logging/LoggerFactory.ts';
import { loggingDef } from '../../util/logging/loggingDef.ts';
import { random } from '../../util/random.ts';
import {
  DefaultFillerCooldownMillis,
  EmptyFillerPickResult,
  FillerPickResult,
  IFillerPicker,
} from '../interfaces/IFillerPicker.ts';

// A (near) re-implementation of the original DTV filler picker.
@injectable()
@loggingDef({
  category: 'scheduling',
})
export class FillerPickerV2 implements IFillerPicker {
  constructor(
    @inject(ProgramPlayHistoryDB)
    private programPlayHistoryDB: ProgramPlayHistoryDB,
    @inject(KEYS.Logger)
    private logger: Logger,
  ) {}

  async pickFiller(
    channel: Channel,
    fillers: ChannelFillerShowWithContent[],
    maxDuration: number,
    now = +dayjs(),
  ): Promise<FillerPickResult> {
    if (isEmpty(fillers)) {
      return Promise.resolve(EmptyFillerPickResult);
    }

    const fillerRepeatCooldownMs =
      channel.fillerRepeatCooldown ?? DefaultFillerCooldownMillis;

    const channelHistoryForFiller =
      await this.programPlayHistoryDB.getFillerHistory(channel.uuid);

    const fillerPlayHistoryById = groupBy(
      channelHistoryForFiller,
      (history) => history.fillerListId,
    );

    let listWeight = 0;
    let pickedFiller: Maybe<ChannelFillerShowWithContent>;
    let minimumWait = Number.MAX_SAFE_INTEGER;

    if (this.logger.isLevelEnabled('debug')) {
      const uniqFillers = sumBy(fillers, (f) => f.fillerContent.length);
      this.logger.debug(
        'Considering %d filler lists for channel %s. %d total programs',
        fillers.length,
        channel.uuid,
        uniqFillers,
      );
    }

    for (const filler of fillers) {
      const { weight, cooldown, fillerShow, fillerContent } = filler;
      const fillerHistory = fillerPlayHistoryById[fillerShow.uuid];
      filler.fillerContent = random.shuffle(filler.fillerContent);

      let programTotalWeight = 0;
      for (const program of fillerContent) {
        if (program.duration > maxDuration) {
          this.logger.trace(
            'Skipping program %s (%s) from filler list %s because it is too long (%d > %d)',
            program.uuid,
            program.title,
            fillerShow.uuid,
            program.duration,
            maxDuration,
          );
          continue;
        }
        const programLastPlayed = fillerHistory?.find(
          (h) => h.programUuid === program.uuid,
        );
        const timeSincePlayed = programLastPlayed
          ? now - dayjs(programLastPlayed.playedAt).valueOf()
          : OneDayMillis;

        // Channel level cooldown in effect for this program
        if (timeSincePlayed < fillerRepeatCooldownMs) {
          this.logger.trace(
            'Skipping program %s (%s) from filler list %s because cooldown is in effect (%d < %d)',
            program.uuid,
            program.title,
            fillerShow.uuid,
            timeSincePlayed,
            fillerRepeatCooldownMs,
          );
          const timeUntilProgramCanPlay =
            fillerRepeatCooldownMs - timeSincePlayed;
          if (program.duration + timeUntilProgramCanPlay <= maxDuration) {
            minimumWait = Math.min(minimumWait, timeUntilProgramCanPlay);
          }
        } else if (!pickedFiller) {
          // Need to see if we can even use this list.
          const fillerHistory = fillerPlayHistoryById[fillerShow.uuid];
          const lastPlay = maxBy(fillerHistory, (history) =>
            dayjs(history.playedAt).valueOf(),
          );
          const timeSincePlayedFiller = lastPlay
            ? now - dayjs(lastPlay.playedAt).valueOf()
            : OneDayMillis;
          // Weights always count, despite cooldowns.
          listWeight += weight;
          if (timeSincePlayedFiller >= cooldown) {
            if (this.weightedPick('filler', weight, listWeight)) {
              pickedFiller = filler;
            } else {
              // Didn't pick this filler list based on weight
              break;
            }
          } else {
            this.logger.trace(
              'Cannot pick filler list %s (%s) because cooldown is in effect (%d < %d)',
              filler.fillerShowUuid,
              filler.fillerShow.name,
              timeSincePlayedFiller,
              cooldown,
            );
            const timeUntilListIsCandidate = cooldown - timeSincePlayedFiller;
            if (program.duration + timeUntilListIsCandidate <= maxDuration) {
              minimumWait = Math.min(
                minimumWait,
                program.duration + timeUntilListIsCandidate,
              );
            }
            // Cannot use this list because cooldown is in effect
            break;
          }

          const normalizedSince = normalizeSince(
            timeSincePlayed >= FiveMinutesMillis
              ? FiveMinutesMillis
              : timeSincePlayed,
          );
          const normalizedDuration = normalizeDuration(program.duration);
          const programWeight = normalizedSince + normalizedDuration;
          programTotalWeight += programWeight;
          if (this.weightedPick('program', programWeight, programTotalWeight)) {
            return {
              filler: program,
              fillerListId: pickedFiller.fillerShowUuid,
              minimumWait: 0,
            };
          }
        }
      }
    }

    return {
      filler: null,
      fillerListId: null,
      minimumWait,
    };
  }

  // Exposed to we can delineate weighted pick calls in our tests
  // It's ugly... but it works.
  weightedPick(_reason: string, numerator: number, denominator: number) {
    return random.bool(numerator, denominator);
  }
}

// Moving old DTV normalizer functions here. Slightly changing them to make them
// more readable and less verbose
function normalizeDuration(durationMs: number) {
  let durationSeconds = durationMs / (60 * 1000);
  if (durationSeconds >= 3.0) {
    durationSeconds = 3.0 + Math.log(durationSeconds);
  }
  const y = 10000 * (Math.ceil(durationSeconds * 1000) + 1);
  return Math.ceil(y / 1000000) + 1;
}

function normalizeSince(timeSinceMs: number) {
  let y = Math.ceil(timeSinceMs / 600) + 1;
  y = y * y;
  return Math.ceil(y / 1000000) + 1;
}
