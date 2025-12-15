import { isNonEmptyString, seq } from '@tunarr/shared/util';
import { BaseSlot } from '@tunarr/types/api';
import DataLoader from 'dataloader';
import { inject, injectable } from 'inversify';
import {
  flatten,
  isError,
  isNumber,
  partition,
  reduce,
  uniq,
  values,
} from 'lodash-es';
import { CustomShowDB } from '../../db/CustomShowDB.ts';
import { FillerDB } from '../../db/FillerListDB.ts';
import { IChannelDB } from '../../db/interfaces/IChannelDB.ts';
import { ProgramDB } from '../../db/ProgramDB.ts';
import { ProgramWithRelationsOrm } from '../../db/schema/derivedTypes.ts';
import { ProgramGroupingType } from '../../db/schema/ProgramGrouping.ts';
import { SmartCollectionsDB } from '../../db/SmartCollectionsDB.ts';
import { KEYS } from '../../types/inject.ts';
import { zipWithIndex } from '../../util/index.ts';
import { Logger } from '../../util/logging/LoggerFactory.ts';
import {
  isProgramGroupingDocument,
  isTerminalProgramDocument,
} from '../../util/search.ts';
import { filterValues, flipMap } from '../../util/seq.ts';
import { SlotScheduleServiceRequest } from './RandomSlotSchedulerService.ts';
import {
  CustomShowContext,
  SlotSchedulerProgram,
} from './slotSchedulerUtil.ts';
import { TimeSlotScheduleServiceRequest } from './TimeSlotSchedulerService.ts';

@injectable()
export class SlotSchedulerHelper {
  private programLoader!: DataLoader<string, ProgramWithRelationsOrm>;
  private descendantsLoader!: DataLoader<
    [string, ProgramGroupingType],
    readonly [string, ProgramWithRelationsOrm[]]
  >;

  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(CustomShowDB) private customShowDB: CustomShowDB,
    @inject(FillerDB) private fillerDB: FillerDB,
    @inject(KEYS.ProgramDB) private programDB: ProgramDB,
    @inject(SmartCollectionsDB) private smartCollectionsDB: SmartCollectionsDB,
    @inject(KEYS.ChannelDB) private channelDB: IChannelDB,
  ) {
    this.programLoader = new DataLoader<string, ProgramWithRelationsOrm>(
      (keys) => this.programDB.getProgramsByIds(keys),
      { cache: false, maxBatchSize: 100 },
    );
    this.descendantsLoader = new DataLoader(
      (keys) => {
        return Promise.all(
          keys.map(([groupId, type]) =>
            this.programDB
              .getProgramGroupingDescendants(groupId, type)
              .then((result) => [groupId, result] as const),
          ),
        );
      },
      {
        maxBatchSize: 100,
        cache: false,
      },
    );
  }

  async collectSlotProgramming(
    request: TimeSlotScheduleServiceRequest | SlotScheduleServiceRequest,
  ) {
    let programs: ProgramWithRelationsOrm[];
    if (request.type === 'channel') {
      programs = await this.getPrograms(request.channelId);
    } else {
      programs = await this.programDB.getProgramsByIds(request.programIds);
    }

    const [
      customShowPrograms,
      fillerPrograms,
      showPrograms,
      smartCollectionPrograms,
    ] = await Promise.all([
      this.materializeCustomShowPrograms(request.schedule.slots),
      this.materializeFillerLists(request.schedule.slots),
      this.materializeShows(request.schedule.slots),
      this.materializeSmartCollections(request.schedule.slots),
    ]);

    const customShowContexts = reduce(
      customShowPrograms,
      (acc, programs, csId) => {
        for (const [program, i] of zipWithIndex(programs)) {
          const existing = acc[program.uuid] ?? [];
          existing.push({ customShowId: csId, index: i });
          acc[program.uuid] = existing;
        }
        return acc;
      },
      {} as Record<string, CustomShowContext[]>,
    );

    const fillerListsByProgramId = flipMap(
      fillerPrograms,
      (program) => program.uuid,
    );
    const smartCollectionByProgramId = flipMap(
      smartCollectionPrograms,
      (program) => program.uuid,
    );

    const seenContentIds = new Set<string>();
    const allPrograms = programs
      .concat(flatten(values(customShowPrograms)))
      .concat(flatten(values(fillerPrograms)))
      .concat(flatten(values(smartCollectionPrograms)))
      .concat(showPrograms)
      .concat();

    const slotPrograms: SlotSchedulerProgram[] = [];
    // Do some deduping.
    for (const program of allPrograms) {
      if (seenContentIds.has(program.uuid)) {
        continue;
      }

      slotPrograms.push({
        ...program,
        parentCustomShows: customShowContexts[program.uuid] ?? [],
        parentFillerLists: fillerListsByProgramId[program.uuid] ?? [],
        parentSmartCollections: smartCollectionByProgramId[program.uuid] ?? [],
      });
    }

    return slotPrograms;
  }

  async materializeCustomShowPrograms(slots: BaseSlot[]) {
    // Here's the big one - find shows that are included in the schedule but
    // not currently saved to the channel.
    const slottedCustomShows = reduce(
      slots,
      (acc, curr) => {
        if (curr.type === 'custom-show') {
          acc.add(curr.customShowId);
        }
        return acc;
      },
      new Set<string>(),
    );

    // Query
    return Object.fromEntries(
      await Promise.all(
        [...slottedCustomShows].map((show) =>
          this.customShowDB
            .getShowProgramsOrm(show)
            .then((programs) => [show, programs] as const),
        ),
      ),
    );
  }

  async materializeFillerLists(
    slots: BaseSlot[],
  ): Promise<Record<string, ProgramWithRelationsOrm[]>> {
    // Here's the big one - find shows that are included in the schedule but
    // not currently saved to the channel.
    const slotFiller = slots.flatMap((slot) => {
      switch (slot.type) {
        case 'filler':
        case 'flex':
        case 'redirect':
          return [];
        case 'movie':
        case 'show':
        case 'custom-show':
        case 'smart-collection':
          return slot.filler?.map(({ fillerListId }) => fillerListId) ?? [];
      }
    });

    const slottedFillerLists = reduce(
      slots,
      (acc, curr) => {
        if (curr.type === 'filler') {
          acc.add(curr.fillerListId);
        }
        return acc;
      },
      new Set<string>(),
    );

    slotFiller.forEach((id) => slottedFillerLists.add(id));

    // Query
    return Object.fromEntries(
      await Promise.all(
        [...slottedFillerLists].map((list) =>
          this.fillerDB
            .getFillerProgramsOrm(list)
            .then((programs) => [list, programs] as const),
        ),
      ),
    );
  }

  async materializeShows(slots: BaseSlot[]) {
    const showIds = uniq(
      seq.collect(slots, (slot) => {
        if (slot.type !== 'show') {
          return;
        }
        return slot.showId;
      }),
    );

    const allDescendants: ProgramWithRelationsOrm[] = [];
    const batchResult = await this.descendantsLoader.loadMany(
      showIds.map((id) => [id, 'show'] as const),
    );
    for (const result of batchResult) {
      if (isError(result)) {
        this.logger.warn(result, 'Error while loading descedents for group');
        continue;
      }
      allDescendants.push(...result[1]);
    }

    return seq.collect(allDescendants, (program) => {
      if (!program.mediaSourceId) {
        return;
      }
      return program;
    });
  }

  async materializeSmartCollections(
    slots: BaseSlot[],
  ): Promise<Record<string, ProgramWithRelationsOrm[]>> {
    const collectionIds = uniq(
      seq.collect(slots, (slot) => {
        if (slot.type !== 'smart-collection') {
          return;
        }
        return slot.smartCollectionId;
      }),
    );

    if (collectionIds.length === 0) {
      return {};
    }

    const resultsBySmartCollection = Object.fromEntries(
      await Promise.all(
        collectionIds.map((id) =>
          this.smartCollectionsDB
            .materializeSmartCollection(id, false)
            .then((results) => [id, results] as const),
        ),
      ),
    );

    const terminalProgramsToSmartCollection = flipMap(
      filterValues(resultsBySmartCollection, isTerminalProgramDocument),
      (v) => v.id,
    );
    const groupingsToSmartCollection = flipMap(
      filterValues(resultsBySmartCollection, isProgramGroupingDocument),
      (v) => v.id,
    );

    const [groups, programs] = partition(
      flatten(values(resultsBySmartCollection)),
      (doc) => isProgramGroupingDocument(doc),
    );

    const descendantsByGroupingId = Object.fromEntries(
      await Promise.all(
        groups.map((grouping) =>
          this.programDB
            .getProgramGroupingDescendants(grouping.id, grouping.type)
            .then((descendants) => [grouping.id, descendants] as const),
        ),
      ),
    );

    const materializedPrograms = new Set(
      flatten(values(descendantsByGroupingId)).map((program) => program.uuid),
    );

    const needsMaterialization = programs.filter(
      (program) => !materializedPrograms.has(program.id),
    );

    const dbPrograms = seq.collect(
      await this.programLoader.loadMany(
        needsMaterialization.map((program) => program.id),
      ),
      (programOrError) => {
        if (isError(programOrError)) {
          this.logger.warn(programOrError, 'Error loading program');
          return;
        }
        return programOrError;
      },
    );

    const programsBySmartCollectionId = {} as Record<
      string,
      ProgramWithRelationsOrm[]
    >;
    for (const [groupingId, descendants] of Object.entries(
      descendantsByGroupingId,
    )) {
      const smartCollectionIds = groupingsToSmartCollection[groupingId];
      if (!smartCollectionIds) {
        continue;
      }

      for (const smartCollection of smartCollectionIds) {
        programsBySmartCollectionId[smartCollection] ??= [];
        programsBySmartCollectionId[smartCollection].push(
          ...descendants.filter((program) =>
            isNonEmptyString(program.mediaSourceId),
          ),
        );
      }
    }

    for (const program of dbPrograms) {
      if (!program.mediaSourceId) {
        continue;
      }

      const smartCollectionIds =
        terminalProgramsToSmartCollection[program.uuid] ?? [];

      for (const id of smartCollectionIds) {
        programsBySmartCollectionId[id] ??= [];
        programsBySmartCollectionId[id].push(program);
      }
    }

    return programsBySmartCollectionId;
  }

  async getPrograms(channelId: string | number) {
    if (isNumber(channelId)) {
      channelId = (await this.channelDB.getChannel(channelId, false))!.uuid;
    }
    const channelAndLineup =
      await this.channelDB.getChannelAndPrograms(channelId);
    if (!channelAndLineup) {
      throw new Error(`Channel ID = ${channelId} not found!`);
    }

    return channelAndLineup.programs;
  }
}
