import { inject, injectable, unmanaged } from 'inversify';
import { BuildSlotCycleCommand } from '../../commands/BuildSlotCycleCommand.ts';
import type { Lineup } from '../../db/derived_types/Lineup.ts';
import type { IChannelDB } from '../../db/interfaces/IChannelDB.ts';
import type { ISettingsDB } from '../../db/interfaces/ISettingsDB.ts';
import { KEYS } from '../../types/inject.ts';
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
@injectable()
export class SlotCycleBoundaryService {
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
   * channel's start time and its place in the schedule.
   */
  async regenerateChannel(channelId: string, now: number = Date.now()) {
    await this.lineupLock.run(channelId, async () => {
      const loaded = await this.loadRebuildingChannel(channelId);
      if (!loaded) {
        return;
      }

      const { lineup, schedule, state } = loaded;
      const opts = this.cycleOptions(channelId, lineup, now);

      // Nothing built yet, so there is no airing cycle to cascade from.
      const built =
        state.cycles.length === 0
          ? await initializeCycles(cycleStartTime(schedule, now), opts)
          : await cascadeCycles(state, opts);

      await this.persist(channelId, state, built);
    });
  }

  /**
   * Advances every rebuilding channel. One channel's failure does not stop
   * the rest.
   */
  async advanceAll(now: number = Date.now()) {
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

  // The lineup file and channel.duration go first, then startTime, so a reader
  // that catches the gap sees the old position of the new lineup rather than
  // the new position of the old one.
  private async persist(
    channelId: string,
    previous: CycleState,
    next: CycleState,
  ) {
    if (next.cycles.length === 0) {
      this.logger.warn(
        'Slot schedule for channel %s produced no cycles; leaving its lineup alone',
        channelId,
      );
      return;
    }

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
