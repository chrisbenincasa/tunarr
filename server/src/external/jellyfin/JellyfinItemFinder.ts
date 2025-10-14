import { ProgramDaoMinter } from '@/db/converters/ProgramMinter.js';
import type { IProgramDB } from '@/db/interfaces/IProgramDB.js';
import { ProgramType } from '@/db/schema/Program.js';
import { MediaSourceType } from '@/db/schema/base.js';
import type { ProgramWithExternalIds } from '@/db/schema/derivedTypes.js';
import { MediaSourceApiFactory } from '@/external/MediaSourceApiFactory.js';
import { GlobalScheduler } from '@/services/Scheduler.js';
import { ReconcileProgramDurationsTask } from '@/tasks/ReconcileProgramDurationsTask.js';
import { KEYS } from '@/types/inject.js';
import { Maybe } from '@/types/util.js';
import { groupByUniq, isDefined, isNonEmptyString, run } from '@/util/index.js';
import { type Logger } from '@/util/logging/LoggerFactory.js';
import { JellyfinItem, JellyfinItemKind } from '@tunarr/types/jellyfin';
import {
  inject,
  injectable,
  interfaces,
  LazyServiceIdentifier,
} from 'inversify';
import { find, isUndefined, some } from 'lodash-es';
import { match } from 'ts-pattern';
import { container } from '../../container.ts';
import {
  ProgramExternalIdType,
  programExternalIdTypeFromJellyfinProvider,
} from '../../db/custom_types/ProgramExternalIdType.ts';
import { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import { MediaSourceId } from '../../db/schema/base.js';
import { ReconcileProgramDurationsTaskFactory } from '../../tasks/TasksModule.ts';
import { JellyfinGetItemsQuery } from './JellyfinApiClient.ts';

@injectable()
export class JellyfinItemFinder {
  constructor(
    @inject(KEYS.ProgramDB) private programDB: IProgramDB,
    @inject(KEYS.Logger) private logger: Logger,
    @inject(new LazyServiceIdentifier(() => MediaSourceApiFactory))
    private mediaSourceApiFactory: MediaSourceApiFactory,
    @inject(MediaSourceDB) private mediaSourceDB: MediaSourceDB,
    @inject(KEYS.ProgramDaoMinterFactory)
    private programMinterFactory: interfaces.AutoFactory<ProgramDaoMinter>,
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
      (eid) => eid.sourceType === ProgramExternalIdType.JELLYFIN,
    );

    const minter = this.programMinterFactory();
    const newExternalId = minter.mintJellyfinExternalIdForApiItem(
      program.externalSourceId,
      program.uuid,
      potentialApiMatch,
    );

    await this.programDB.replaceProgramExternalId(
      program.uuid,
      newExternalId,
      oldExternalId,
    );

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

    const updatedProgram = minter.mint(mediaSource, library, {
      sourceType: 'jellyfin',
      program: potentialApiMatch,
    });

    if (updatedProgram.duration !== program.duration) {
      await this.programDB.updateProgramDuration(
        program.uuid,
        updatedProgram.duration,
      );
      const task = container.get<ReconcileProgramDurationsTaskFactory>(
        ReconcileProgramDurationsTask.KEY,
      )({
        type: 'program',
        programId: program.uuid,
      });

      GlobalScheduler.runTask(task);
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

  async findForProgram(program: ProgramWithExternalIds) {
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
    const getPotentialMatchByType = async (type: ProgramExternalIdType) => {
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

        const queryResult = await jfClient.getRawItems(
          null,
          [jellyfinItemType],
          [],
          null,
          opts,
        );

        return queryResult.either(
          (data) => {
            return find(data.Items, (match) =>
              some(
                match.ProviderIds,
                (val, key) =>
                  programExternalIdTypeFromJellyfinProvider(key) === type &&
                  val === idsBySourceType[type].externalKey,
              ),
            );
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

    let possibleMatch: Maybe<JellyfinItem> = await getPotentialMatchByType(
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
