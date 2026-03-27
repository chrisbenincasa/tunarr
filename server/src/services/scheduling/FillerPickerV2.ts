import dayjs from 'dayjs';
import { inject, injectable } from 'inversify';
import { groupBy, isEmpty, maxBy, sumBy } from 'lodash-es';
import { ProgramPlayHistoryDB } from '../../db/ProgramPlayHistoryDB.ts';
import { ChannelOrm } from '../../db/schema/Channel.ts';
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
    channel: ChannelOrm,
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

    // Phase 1: Select a filler list using weighted reservoir sampling.
    // Shuffle first so that lists with equal weights don't always resolve
    // in the same DB-insertion order.
    const shuffledFillers = random.shuffle([...fillers]);
    let listWeight = 0;
    let pickedFiller: Maybe<ChannelFillerShowWithContent>;

    for (const filler of shuffledFillers) {
      const { weight, cooldown, fillerShow } = filler;
      const fillerHistory = fillerPlayHistoryById[fillerShow.uuid];
      const lastPlay = maxBy(fillerHistory, (history) =>
        dayjs(history.playedAt).valueOf(),
      );
      const timeSincePlayedFiller = lastPlay
        ? now - dayjs(lastPlay.playedAt).valueOf()
        : OneDayMillis;
      const fillerCooldownMs = cooldown * 1000;

      if (timeSincePlayedFiller >= fillerCooldownMs) {
        // Check whether this list has at least one program that fits
        // maxDuration and is past its repeat cooldown. Only lists with
        // eligible programs participate in reservoir sampling — otherwise
        // we'd risk picking a list and then failing to find a program.
        let hasEligibleProgram = false;
        for (const program of filler.fillerContent) {
          if (program.duration > maxDuration) continue;
          const programLastPlayed = fillerHistory?.find(
            (h) => h.programUuid === program.uuid,
          );
          const timeSincePlayed = programLastPlayed
            ? now - dayjs(programLastPlayed.playedAt).valueOf()
            : OneDayMillis;
          if (timeSincePlayed >= fillerRepeatCooldownMs) {
            hasEligibleProgram = true;
          } else {
            const timeUntilProgramCanPlay =
              fillerRepeatCooldownMs - timeSincePlayed;
            if (program.duration + timeUntilProgramCanPlay <= maxDuration) {
              minimumWait = Math.min(minimumWait, timeUntilProgramCanPlay);
              this.logger.trace('New minimumWait: %d', minimumWait);
            }
          }
        }

        if (hasEligibleProgram) {
          listWeight += weight;
          if (this.weightedPick('filler', weight, listWeight)) {
            pickedFiller = filler;
          }
        } else {
          this.logger.trace(
            'Skipping filler list %s (%s) — no eligible programs (all on cooldown or too long)',
            filler.fillerShowUuid,
            filler.fillerShow.name,
          );
        }
        // Continue iterating — reservoir sampling requires seeing all candidates.
      } else {
        this.logger.trace(
          'Cannot pick filler list %s (%s) because cooldown is in effect (%d < %d), last played at %s',
          filler.fillerShowUuid,
          filler.fillerShow.name,
          timeSincePlayedFiller,
          fillerCooldownMs,
          lastPlay?.playedAt ? dayjs(lastPlay.playedAt).format() : 'never',
        );
        // Track minimumWait for the list cooldown.
        const timeUntilListIsCandidate =
          fillerCooldownMs - timeSincePlayedFiller;
        const shortestProgram = filler.fillerContent.reduce(
          (min, p) => Math.min(min, p.duration),
          Number.MAX_SAFE_INTEGER,
        );
        if (shortestProgram + timeUntilListIsCandidate <= maxDuration) {
          minimumWait = Math.min(
            minimumWait,
            shortestProgram + timeUntilListIsCandidate,
          );
          this.logger.trace('New minimumWait: %d', minimumWait);
        }
      }
    }

    if (!pickedFiller) {
      return {
        filler: null,
        fillerListId: null,
        minimumWait: minimumWait < 0 ? 15_000 : minimumWait,
      };
    }

    // Phase 2: Select a program from the picked list using weighted
    // reservoir sampling. Shuffle so that programs with equal weights
    // don't always resolve in the same order.
    const fillerHistory = fillerPlayHistoryById[pickedFiller.fillerShow.uuid];
    const shuffledPrograms = random.shuffle([...pickedFiller.fillerContent]);
    let programTotalWeight = 0;

    for (const program of shuffledPrograms) {
      if (program.duration > maxDuration) {
        this.logger.trace(
          'Skipping program %s (%s) from filler list %s because it is too long (%d > %d)',
          program.uuid,
          program.title,
          pickedFiller.fillerShow.uuid,
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
          pickedFiller.fillerShow.uuid,
          timeSincePlayed,
          fillerRepeatCooldownMs,
        );
        const timeUntilProgramCanPlay =
          fillerRepeatCooldownMs - timeSincePlayed;
        if (program.duration + timeUntilProgramCanPlay <= maxDuration) {
          minimumWait = Math.min(minimumWait, timeUntilProgramCanPlay);
          this.logger.trace('New minimumWait: %d', minimumWait);
        }
        continue;
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

    return {
      filler: null,
      fillerListId: null,
      minimumWait: minimumWait < 0 ? 15_000 : minimumWait,
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
