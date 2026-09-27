import { seq } from '@tunarr/shared/util';
import { isNonEmptyString } from '@tunarr/shared/util';
import type {
  CondensedChannelProgram,
  CondensedContentProgram,
} from '@tunarr/types';
import type { CondensedCustomProgram } from '@tunarr/types/schemas';
import { chunk, orderBy } from 'lodash-es';
import { P, match } from 'ts-pattern';
import { getProgramOrderer } from './ProgramIterator.js';
import { IndexBasedProgramIterator } from './ProgramIterator.js';
import { random } from './RandomSlotsService.ts';
import {
  createIndexByIdMap,
  type SlotSchedulerProgram,
} from './slotSchedulerUtil.ts';

abstract class ProgramChunkedShuffle<
  ProgramT extends CondensedChannelProgram,
> extends IndexBasedProgramIterator<ProgramT> {
  constructor(
    programs: SlotSchedulerProgram[],
    orderer: (program: SlotSchedulerProgram) => string | number,
    asc: boolean = true,
  ) {
    super(
      seq.rotateArray(
        orderBy(programs, orderer, [asc ? 'asc' : 'desc']),
        random.integer(0, programs.length),
      ),
    );
  }
}

export class ContentProgramChunkedShuffle extends ProgramChunkedShuffle<CondensedContentProgram> {
  protected mint(program: SlotSchedulerProgram): CondensedContentProgram {
    return {
      type: 'content',
      duration: program.duration,
      id: program.uuid,
    };
  }
}

export class CustomProgramChunkedShuffle extends ProgramChunkedShuffle<CondensedCustomProgram> {
  private indexById!: Record<string, number>;

  constructor(
    private customShowId: string,
    programs: SlotSchedulerProgram[],
    asc: boolean = true,
  ) {
    const indexById = createIndexByIdMap(programs, customShowId);
    super(programs, (program) => indexById[program.uuid] ?? -1, asc);
    this.indexById = indexById;
  }

  protected mint(program: SlotSchedulerProgram): CondensedCustomProgram {
    return {
      customShowId: this.customShowId,
      duration: program.duration,
      id: program.uuid,
      index: this.indexById[program.uuid]!,
      type: 'custom',
    };
  }
}

/**
 * Groups programs by their "show" (or equivalent grouping unit -- artist for
 * tracks, a single shared bucket for movies/music videos/other videos, since
 * those aren't naturally grouped into a series the way episodes are).
 *
 * Mirrors the grouping key used by createProgramMap in slotSchedulerUtil.ts,
 * but operates over an already-resolved flat list rather than building the
 * full ProgramMapping.
 */
function groupProgramsForBlockShuffle(
  programs: SlotSchedulerProgram[],
): Map<string, SlotSchedulerProgram[]> {
  const groups = new Map<string, SlotSchedulerProgram[]>();
  for (const program of programs) {
    const key = match(program)
      .returnType<string>()
      .with(
        { type: P.union('movie', 'music_video', 'other_video') },
        () => 'movie',
      )
      .with(
        { type: 'episode', show: { uuid: P.when(isNonEmptyString) } },
        (ep) => `show.${ep.show.uuid}`,
      )
      .with(
        { type: 'episode', tvShowUuid: P.when(isNonEmptyString) },
        (ep) => `show.${ep.tvShowUuid}`,
      )
      .with(
        { type: 'track', artist: { uuid: P.when(isNonEmptyString) } },
        (track) => `artist.${track.artist.uuid}`,
      )
      .otherwise(() => 'ungrouped');
    const existing = groups.get(key);
    if (existing) {
      existing.push(program);
    } else {
      groups.set(key, [program]);
    }
  }
  return groups;
}

/**
 * Implements "Block Shuffle" (N episodes per show, then move to the next
 * show, looping back to the first once every show has had a turn) for a
 * dynamically-resolved list of programs -- e.g. the contents of a Smart
 * Collection at schedule-generation time.
 *
 * This mirrors the client-side-only algorithm in
 * web/src/hooks/programming_controls/useBlockShuffle.ts (grouping, chunking,
 * and optional short-program looping), adapted to run server-side against
 * SlotSchedulerProgram so it can be used as a genuine slot ordering mode
 * rather than a one-time reorder of an already-static program list.
 */
export class ContentProgramBlockShuffle extends IndexBasedProgramIterator<CondensedContentProgram> {
  constructor(
    programs: SlotSchedulerProgram[],
    blockSize: number,
    loopShortPrograms: boolean = true,
    asc: boolean = true,
  ) {
    super(
      ContentProgramBlockShuffle.buildBlockShuffledList(
        programs,
        Math.max(1, Math.floor(blockSize)),
        loopShortPrograms,
        asc,
      ),
    );
  }

  private static buildBlockShuffledList(
    programs: SlotSchedulerProgram[],
    blockSize: number,
    loopShortPrograms: boolean,
    asc: boolean,
  ): SlotSchedulerProgram[] {
    if (programs.length === 0) {
      return [];
    }

    const orderer = getProgramOrderer('next');
    const groups = groupProgramsForBlockShuffle(programs);

    // Sort each group's programs by their natural episode/track order, then
    // chunk into blocks of `blockSize`.
    const chunkedGroups = new Map<string, SlotSchedulerProgram[][]>();
    for (const [key, groupPrograms] of groups) {
      const sorted = orderBy(groupPrograms, orderer, [asc ? 'asc' : 'desc']);
      chunkedGroups.set(key, chunk(sorted, blockSize));
    }

    const maxChunkCount = Math.max(
      ...Array.from(chunkedGroups.values(), (chunks) => chunks.length),
    );

    if (loopShortPrograms) {
      for (const [key, groupPrograms] of groups) {
        const chunks = chunkedGroups.get(key)!;
        if (chunks.length < maxChunkCount && groupPrograms.length > 0) {
          const sorted = orderBy(groupPrograms, orderer, [
            asc ? 'asc' : 'desc',
          ]);
          const targetLength = maxChunkCount * blockSize;
          const padded = [...sorted];
          let i = 0;
          while (padded.length < targetLength) {
            padded.push(sorted[i % sorted.length]!);
            i++;
          }
          chunkedGroups.set(key, chunk(padded, blockSize));
        }
      }
    }

    // Randomize the starting rotation offset (which group airs "first" in
    // the loop) but keep a stable group order thereafter, mirroring
    // ContentProgramChunkedShuffle's use of a random start point rather than
    // a fully random shuffle each generation.
    const groupKeys = seq.rotateArray(
      Array.from(chunkedGroups.keys()),
      random.integer(0, chunkedGroups.size),
    );

    const result: SlotSchedulerProgram[] = [];
    for (let i = 0; i < maxChunkCount; i++) {
      for (const key of groupKeys) {
        const chunks = chunkedGroups.get(key)!;
        // Do NOT modulo-wrap here: padding above already extends every
        // group to maxChunkCount chunks when loopShortPrograms is true. If
        // it's false, a group simply has fewer chunks and should drop out
        // of later rounds entirely, rather than silently repeating.
        const block = chunks[i];
        if (block) {
          result.push(...block);
        }
      }
    }

    return result;
  }

  protected mint(program: SlotSchedulerProgram): CondensedContentProgram {
    return {
      type: 'content',
      duration: program.duration,
      id: program.uuid,
    };
  }
}
