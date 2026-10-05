import type { ProgramDaoMinter } from '@/db/converters/ProgramMinter.js';
import type { IProgramDB } from '@/db/interfaces/IProgramDB.js';
import { ProgramType } from '@/db/schema/Program.js';
import { MediaSourceType } from '@/db/schema/base.js';
import type { ProgramWithExternalIds } from '@/db/schema/derivedTypes.js';
import { MediaSourceApiFactory } from '@/external/MediaSourceApiFactory.js';
import { GlobalScheduler } from '@/services/Scheduler.js';
import { ReconcileProgramDurationsTask } from '@/tasks/ReconcileProgramDurationsTask.js';
import { autoFactoryKey, KEYS } from '@/types/inject.js';
import type { Maybe } from '@/types/util.js';
import { groupByUniq, isDefined, isNonEmptyString, run } from '@/util/index.js';
import { InjectLogger } from '@/util/inject.js';
import { type Logger } from '@/util/logging/LoggerFactory.js';
import type { TerminalProgram } from '@tunarr/types';
import { isTerminalItemType } from '@tunarr/types';
import type { JellyfinItemKind } from '@tunarr/types/jellyfin';
import { inject, injectable, LazyServiceIdentifier } from 'inversify';
import { find, isUndefined } from 'lodash-es';
import { match } from 'ts-pattern';
import { ProgramExternalIdType } from '../../db/custom_types/ProgramExternalIdType.ts';
import { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import type { MediaSourceId } from '../../db/schema/base.js';
import type { TerminalJellyfinItem } from '../../types/Media.ts';
import type { JellyfinGetItemsQuery } from './JellyfinApiClient.ts';

@injectable()
export class JellyfinItemFinder {
  @InjectLogger() declare private readonly logger: Logger;

  constructor(
    @inject(KEYS.ProgramDB) private programDB: IProgramDB,
    @inject(new LazyServiceIdentifier(() => MediaSourceApiFactory))
    private mediaSourceApiFactory: MediaSourceApiFactory,
    @inject(MediaSourceDB) private mediaSourceDB: MediaSourceDB,
    @inject(KEYS.ProgramDaoMinterFactory)
    private programMinterFactory: () => ProgramDaoMinter,
    @inject(autoFactoryKey(ReconcileProgramDurationsTask))
    private reconcileDurationTaskFactory: () => ReconcileProgramDurationsTask,
  ) {}

  async findForProgramAndUpdate(programId: string) {
    const program = await this.programDB.getProgramById(programId);

    if (!program) {
      this.logger.warn('No program found with ID: %s', programId);
      return;
    }

    const potentialApiMatch = await this.findForProgram(program);

    if (!potentialApiMatch) {
      return;
    }

    const oldExternalId = find(
      program.externalIds,
      (eid) => eid.sourceType === ProgramExternalIdType.JELLYFIN.valueOf(),
    );

    const minter = this.programMinterFactory();

    // Right now just check if the durations are different.
    // otherwise we might blow away details we already have, since
    // Jellyfin collects metadata asynchronously (sometimes)
    const mediaSource = await run(async () => {
      if (!isNonEmptyString(program.mediaSourceId)) {
        throw new Error(`Program ${program.uuid} has no media source ID`);
      }

      const ms = await this.findMediaSource(program.mediaSourceId);

      if (!ms)
        throw new Error(
          `Could not find media source by name: ${program.externalSourceId}`,
        );
      return ms;
    });

    if (!program.libraryId) {
      throw new Error(
        'Cannot find JF item match without a library ID. Consider syncing the library the missing item belongs to.',
      );
    }

    const library = mediaSource.libraries.find(
      (lib) => lib.uuid === program.libraryId,
    );

    if (!library) {
      throw new Error(
        `Cannot find matching library for program. Library ID = ${program.libraryId}. Maybe the library was deleted?`,
      );
    }

    const updatedProgram = minter.mint(mediaSource, library, potentialApiMatch);

    const newExternalId = updatedProgram.externalIds.find(
      (id) => id.sourceType === 'jellyfin',
    );
    if (newExternalId) {
      await this.programDB.replaceProgramExternalId(
        program.uuid,
        newExternalId,
        oldExternalId,
      );
    }

    if (updatedProgram.program.duration !== program.duration) {
      await this.programDB.updateProgramDuration(
        program.uuid,
        updatedProgram.program.duration,
      );
      const task = this.reconcileDurationTaskFactory();
      GlobalScheduler.runTask(task, {
        type: 'program',
        programId: program.uuid,
      });
    }

    return newExternalId;
  }

  async findForProgramId(programId: string) {
    const program = await this.programDB.getProgramById(programId);
    if (!program) {
      this.logger.warn('No program found with ID: %s', programId);
      return;
    }
    return this.findForProgram(program);
  }

  async findForProgram(
    program: ProgramWithExternalIds,
  ): Promise<Maybe<TerminalProgram>> {
    if (program.sourceType !== 'jellyfin') {
      this.logger.warn('Program does not have source type "jellyfin"');
      return;
    }

    if (!isNonEmptyString(program.mediaSourceId)) {
      this.logger.error(
        'Program %s does not have an associated media source ID',
        program.uuid,
      );
      return;
    }

    const jfClient = await this.mediaSourceApiFactory.getJellyfinApiClientById(
      program.mediaSourceId,
    );

    if (!jfClient) {
      this.logger.error(
        "Couldn't get jellyfin api client for id: %s",
        program.mediaSourceId,
      );
      return;
    }

    // If we can locate the item on JF, there is no problem.
    const existingItem = await jfClient.getRawItem(program.externalKey);
    if (existingItem.isSuccess() && isDefined(existingItem.get())) {
      this.logger.error(
        existingItem,
        'Item exists on Jellyfin - no need to find a new match',
      );
      return;
    }

    // If we find a match we have to:
    // 1. Update the program
    // 2. Update its external IDs
    // 3. Reconcile durations in both the lineup and the guide
    const getPotentialMatchByType = async (
      type: ProgramExternalIdType,
    ): Promise<Maybe<TerminalJellyfinItem>> => {
      if (idsBySourceType[type]) {
        const opts: JellyfinGetItemsQuery = {
          nameStartsWithOrGreater: program.title,
          recursive: true,
        };

        switch (type) {
          case ProgramExternalIdType.TMDB: {
            opts.hasTmdbId = true;
            break;
          }
          case ProgramExternalIdType.IMDB: {
            opts.hasImdbId = true;
            break;
          }
          case ProgramExternalIdType.TVDB: {
            opts.hasTvdbId = true;
            break;
          }
          default:
            break;
        }

        const jellyfinItemType: JellyfinItemKind = match(program.type)
          .returnType<JellyfinItemKind>()
          .with(ProgramType.Movie, () => 'Movie')
          .with(ProgramType.Episode, () => 'Episode')
          .with(ProgramType.Track, () => 'Audio')
          .with(ProgramType.MusicVideo, () => 'MusicVideo')
          .with(ProgramType.OtherVideo, () => 'Video')
          .exhaustive();

        const queryResult = await jfClient.getItems(
          null,
          [jellyfinItemType],
          [],
          null,
          opts,
        );

        return queryResult.either(
          (data) => {
            return data.result
              .filter((item) => {
                return (
                  isTerminalItemType(item) && item.sourceType === 'jellyfin'
                );
              })
              .find((item) => {
                return item.identifiers.some(
                  (id) =>
                    id.type === type.valueOf() &&
                    id.id === idsBySourceType[type].externalKey,
                );
              });
          },
          (err) => {
            this.logger.error(err, 'Error while querying items on Jellyfin');
            return undefined;
          },
        );
      }

      return;
    };

    // Match on:
    // 1. Title
    // 2. external ID type
    const idsBySourceType = groupByUniq(
      program.externalIds,
      (p) => p.sourceType,
    );

    let possibleMatch = await getPotentialMatchByType(
      ProgramExternalIdType.IMDB,
    );

    if (isUndefined(possibleMatch)) {
      possibleMatch = await getPotentialMatchByType(ProgramExternalIdType.TMDB);
    }

    if (isUndefined(possibleMatch)) {
      possibleMatch = await getPotentialMatchByType(ProgramExternalIdType.TVDB);
    }

    return possibleMatch;
  }

  private findMediaSource(mediaSourceId: MediaSourceId) {
    return this.mediaSourceDB.findByType(
      MediaSourceType.Jellyfin,
      mediaSourceId,
    );
  }
}
