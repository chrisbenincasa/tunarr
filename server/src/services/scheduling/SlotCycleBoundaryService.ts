import { bindingScopeValues, inject, injectable, unmanaged } from 'inversify';
import { uniq } from 'lodash-es';
import { BuildSlotCycleCommand } from '../../commands/BuildSlotCycleCommand.ts';
import type { Lineup, LineupItem } from '../../db/derived_types/Lineup.ts';
import { isContentItem } from '../../db/derived_types/Lineup.ts';
import type { IChannelDB } from '../../db/interfaces/IChannelDB.ts';
import type { ISettingsDB } from '../../db/interfaces/ISettingsDB.ts';
import { KEYS } from '../../types/inject.ts';
import { isDefined } from '../../util/index.ts';
import type { Logger } from '../../util/logging/LoggerFactory.ts';
import { LoggerFactory } from '../../util/logging/LoggerFactory.ts';
import type { ChannelLineupLock } from '../ChannelLineupLock.ts';
import { TVGuideService } from '../TvGuideService.ts';
import type { CycleOptions, CycleState } from './slotCycles.ts';
import {
  advanceCycles,
  cascadeCycles,
  cycleStartTime,
  initializeCycles,
  trimAiredCycles,
} from './slotCycles.ts';

const OneHourMs = 60 * 60 * 1000;

/**
 * Keeps rebuilding slot channels one cycle ahead of the guide.
 *
 * A rebuilding channel's lineup is a run of built cycles rather than a loop.
 * This service builds the next cycle before the guide needs it, drops the
 * cycles that have aired, rebuilds everything when the library changes, and
 * restarts the schedule when the server was down past the end of the last
 * built cycle.
 *
 * Every method holds the channel's lineup lock across the whole read, build
 * and write, so a concurrent save or regeneration cannot land in between.
 */
@injectable(bindingScopeValues.Singleton)
export class SlotCycleBoundaryService {
  // Channels already reported as unbuildable or as on-demand, so the
  // five-minute pass says it once instead of forever.
  #quietChannels = new Set<string>();
  #advanceAllRunning = false;

  constructor(
    @inject(KEYS.ChannelDB) private readonly channelDB: IChannelDB,
    @inject(KEYS.SettingsDB) private readonly settingsDB: ISettingsDB,
    @inject(KEYS.ChannelLineupLock)
    private readonly lineupLock: ChannelLineupLock,
    @inject(BuildSlotCycleCommand)
    private readonly buildCycle: BuildSlotCycleCommand,
    @inject(TVGuideService) private readonly tvGuideService: TVGuideService,
    @unmanaged()
    private readonly logger: Logger = LoggerFactory.child({
      className: SlotCycleBoundaryService.name,
    }),
  ) {}

  /**
   * Trims aired cycles and builds ahead to the guide horizon. Catches the
   * channel up when every built cycle has already aired.
   */
  async advanceChannel(channelId: string, now: number = Date.now()) {
    await this.lineupLock.run(channelId, async () => {
      const loaded = await this.loadRebuildingChannel(channelId);
      if (!loaded) {
        return;
      }

      const { lineup, schedule, state } = loaded;
      const opts = this.cycleOptions(channelId, lineup, now);

      if (state.cycles.length === 0) {
        const built = await initializeCycles(
          cycleStartTime(schedule, now),
          opts,
        );
        await this.persist(channelId, state, built);
        return;
      }

      const { state: advanced, changed } = await advanceCycles(
        state,
        cycleStartTime(schedule, now),
        opts,
      );

      if (changed) {
        await this.persist(channelId, state, advanced);
      }
    });
  }

  /**
   * Restarts the channel on a fresh schedule. Used by a slot save, which
   * resets the seed and clears the cycles that came from the old schedule.
   */
  async initializeChannel(channelId: string, now: number = Date.now()) {
    await this.lineupLock.run(channelId, async () => {
      const loaded = await this.loadRebuildingChannel(channelId);
      if (!loaded) {
        return;
      }

      const { lineup, schedule, state } = loaded;
      const built = await initializeCycles(
        cycleStartTime(schedule, now),
        this.cycleOptions(channelId, lineup, now),
      );

      await this.persist(channelId, state, built);
    });
  }

  /**
   * Rebuilds every cycle in place after the library changed, keeping the
   * channel's start time and its place in the schedule. A channel whose
   * cycles have all aired starts over instead.
   */
  async regenerateChannel(channelId: string, now: number = Date.now()) {
    await this.lineupLock.run(channelId, async () => {
      const loaded = await this.loadRebuildingChannel(channelId);
      if (!loaded) {
        return;
      }

      const { lineup, schedule, state } = loaded;
      const opts = this.cycleOptions(channelId, lineup, now);

      // Once every built cycle has aired there is nothing to cascade from.
      // Rebuilding from the old start time would run a scheduling pass per
      // cycle between then and now and produce content nobody can see, so the
      // channel starts over at the current period, as a missed boundary does.
      const allAired = trimAiredCycles(state, now).cycles.length === 0;
      const built = allAired
        ? await initializeCycles(cycleStartTime(schedule, now), opts)
        : await cascadeCycles(state, opts);

      await this.persist(channelId, state, built);
    });
  }

  /**
   * Advances every rebuilding channel. One channel's failure does not stop
   * the rest.
   *
   * A pass that outlives its schedule interval skips the next one rather than
   * queueing a second walk over every channel behind it.
   */
  async advanceAll(now: number = Date.now()) {
    if (this.#advanceAllRunning) {
      this.logger.warn(
        'The previous slot cycle pass is still running; skipping this one',
      );
      return;
    }

    this.#advanceAllRunning = true;
    try {
      const channels = await this.channelDB.getAllChannels();

      for (const channel of channels) {
        try {
          await this.advanceChannel(channel.uuid, now);
        } catch (e) {
          this.logger.error(
            e,
            'Error advancing slot cycles for channel %s',
            channel.uuid,
          );
        }
      }
    } finally {
      this.#advanceAllRunning = false;
    }
  }

  private async loadRebuildingChannel(channelId: string) {
    const channelAndLineup =
      await this.channelDB.loadChannelAndLineup(channelId);
    if (!channelAndLineup) {
      this.logger.warn('Channel ID %s not found', channelId);
      return;
    }

    const { channel, lineup } = channelAndLineup;
    const schedule = lineup.schedule;
    if (!lineup.rebuildEachCycle || !schedule) {
      return;
    }

    // An on-demand channel's position is a cursor into a looping lineup, so a
    // trim moves the lineup out from under it and every cycle write resets it
    // to the start. The save path refuses the combination; this catches a
    // channel that turned on-demand on afterwards.
    if (isDefined(lineup.onDemandConfig)) {
      this.warnOnce(channelId, () =>
        this.logger.warn(
          'Channel %s is on-demand, so its slot schedule loops instead of rebuilding each cycle',
          channelId,
        ),
      );
      return;
    }

    const state: CycleState = {
      startTime: channel.startTime,
      items: [...lineup.items],
      cycles: lineup.cycles ?? [],
      nextSnapshot: lineup.nextCycleSnapshot,
    };

    return { channel, lineup, schedule, state };
  }

  private cycleOptions(
    channelId: string,
    lineup: Lineup,
    now: number,
  ): CycleOptions {
    return {
      now,
      horizonMs: this.settingsDB.xmlTvSettings().programmingHours * OneHourMs,
      build: (startTime, snapshot) =>
        this.buildCycle.execute({ channelId, lineup, startTime, snapshot }),
    };
  }

  // Logs for a channel once, until the thing it reports goes away.
  private warnOnce(channelId: string, warn: () => void) {
    if (this.#quietChannels.has(channelId)) {
      return;
    }
    this.#quietChannels.add(channelId);
    warn();
  }

  // The lineup file and channel.duration go first, then startTime, so a reader
  // that catches the gap sees the old position of the new lineup rather than
  // the new position of the old one.
  private async persist(
    channelId: string,
    previous: CycleState,
    next: CycleState,
  ) {
    if (next.cycles.length === 0) {
      this.warnOnce(channelId, () =>
        this.logger.warn(
          'Slot schedule for channel %s produced no cycles; leaving its lineup alone',
          channelId,
        ),
      );
      return;
    }

    this.#quietChannels.delete(channelId);

    // Programs a new cycle introduced have to reach the join table, or the
    // duration reconciler and the library reference counts stop seeing this
    // channel as one that plays them. The rows are unioned rather than
    // replaced, because a trim drops aired items whose programs the next
    // cycle may well pick again.
    this.channelDB.addChannelPrograms(channelId, contentProgramIds(next.items));

    await this.channelDB.saveLineup(channelId, {
      items: next.items,
      cycles: next.cycles,
      nextCycleSnapshot: next.nextSnapshot ?? null,
    });

    if (next.startTime !== previous.startTime) {
      await this.channelDB.updateChannelStartTime(channelId, next.startTime);
    }

    await this.tvGuideService.updateCachedChannel(channelId, true);
  }
}

function contentProgramIds(items: readonly LineupItem[]): string[] {
  return uniq(
    items.filter((item) => isContentItem(item)).map((item) => item.id),
  );
}
