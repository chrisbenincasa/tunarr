import { ProgramExternalIdType } from '@/db/custom_types/ProgramExternalIdType.js';
import { ProgramSourceType } from '@/db/custom_types/ProgramSourceType.js';
import { withProgramExternalIds } from '@/db/programQueryHelpers.js';
import { ProgramDao } from '@/db/schema/Program.js';
import { NewSingleOrMultiExternalId } from '@/db/schema/ProgramExternalId.js';
import { MediaSourceApiFactory } from '@/external/MediaSourceApiFactory.js';
import { PlexApiClient } from '@/external/plex/PlexApiClient.js';
import { KEYS } from '@/types/inject.js';
import { Maybe } from '@/types/util.js';
import { asyncPool } from '@/util/asyncPool.js';
import { type Logger } from '@/util/logging/LoggerFactory.js';
import { tag } from '@tunarr/types';
import { PlexTerminalMedia } from '@tunarr/types/plex';
import dayjs from 'dayjs';
import { inject, injectable } from 'inversify';
import { Kysely } from 'kysely';
import {
  difference,
  first,
  isEmpty,
  isError,
  isUndefined,
  keys,
  last,
  trimEnd,
} from 'lodash-es';
import { v4 } from 'uuid';
import { IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import { MediaSourceName } from '../../db/schema/base.js';
import { DB } from '../../db/schema/db.ts';
import { Timer } from '../../util/Timer.ts';
import {
  attempt,
  attemptSync,
  groupByUniqProp,
  wait,
} from '../../util/index.js';
import Fixer from './fixer.ts';

@injectable()
export class BackfillProgramExternalIds extends Fixer {
  private timer: Timer;
  constructor(
    @inject(KEYS.Logger) protected logger: Logger,
    @inject(MediaSourceApiFactory)
    private mediaSourceApiFactory: MediaSourceApiFactory,
    @inject(KEYS.Database) private db: Kysely<DB>,
    @inject(KEYS.ProgramDB) private programDB: IProgramDB,
    @inject(MediaSourceDB) private mediaSourceDB: MediaSourceDB,
  ) {
    super();
    this.timer = new Timer(this.logger);
  }

  canRunInBackground: boolean = true;

  async runInternal(): Promise<void> {
    // This makes the paging much faster...
    const firstId = await this.db
      .selectFrom('program')
      .where('sourceType', '=', ProgramSourceType.PLEX)
      .select('uuid')
      .groupBy('program.uuid')
      .orderBy('program.uuid asc')
      .limit(1)
      .executeTakeFirst();

    // No programs.
    if (!firstId) {
      return;
    }

    const getNextPage = (offset: string, first: boolean) => {
      return this.timer.timeAsync(
        'BackfillProgramExternalIds#getPrograms',
        () =>
          this.db
            .selectFrom('program')
            .selectAll()
            .select(withProgramExternalIds)
            .where('sourceType', '=', ProgramSourceType.PLEX)
            .$if(first, (eb) => eb.where('program.uuid', '>=', offset))
            .$if(!first, (eb) => eb.where('program.uuid', '>', offset))
            .limit(1000)
            .groupBy('program.uuid')
            .orderBy('program.uuid asc')
            .execute(),
      );
    };

    let programsPage = await getNextPage(firstId.uuid, true);

    const plexConnections: Record<string, PlexApiClient> = {};
    while (programsPage.length > 0) {
      await wait(50);
      const relevantPrograms = programsPage.filter(
        (program) =>
          !program.externalIds.some((eid) => eid.sourceType === 'plex-guid'),
      );
      if (relevantPrograms.length === 0) {
        continue;
      }

      // process
      const programsByPlexId = groupByUniqProp(
        relevantPrograms,
        'externalSourceId',
      );

      const missingServers = difference(
        keys(programsByPlexId),
        keys(plexConnections),
      );

      const missingNames = missingServers.map((name) =>
        tag<MediaSourceName>(name),
      );
      const serverSettings = await this.mediaSourceDB
        .getAll()
        .then((_) => _.filter((ms) => missingNames.includes(ms.name)));

      for (const server of serverSettings) {
        plexConnections[server.name] =
          await this.mediaSourceApiFactory.getPlexApiClientForMediaSource(
            server,
          );
      }

      for await (const result of asyncPool(
        relevantPrograms,
        (program) =>
          this.handleProgram(
            program,
            plexConnections[program.externalSourceId],
          ),
        { concurrency: 3, waitAfterEachMs: 50 },
      )) {
        if (result.isFailure()) {
          this.logger.error(
            result.error,
            'Error while attempting to get external IDs for program %s',
            result.error.input.uuid,
          );
        } else {
          const upsertResult = await attempt(() =>
            this.programDB.upsertProgramExternalIds(result.get().result),
          );
          if (isError(upsertResult)) {
            this.logger.warn(
              upsertResult,
              'Failed to upsert external IDs: %O',
              result,
            );
          }
        }
      }

      if (isEmpty(programsPage)) {
        // We should've done this already but let's just be safe.
        break;
      }

      programsPage = await getNextPage(last(programsPage)!.uuid, false);
    }
  }

  private async handleProgram(program: ProgramDao, plex: Maybe<PlexApiClient>) {
    if (isUndefined(plex)) {
      throw new Error(
        'No Plex server connection found for server ' +
          program.externalSourceId,
      );
    }

    if (isUndefined(plex.serverId)) {
      throw new Error('Plex server is not a saved media source');
    }

    const metadataResult = await plex.getItemMetadata(program.externalKey);

    if (metadataResult.isFailure()) {
      throw new Error(
        `Could not retrieve metadata for program ID ${program.uuid}, rating key = ${program.externalKey}`,
        { cause: metadataResult.error },
      );
    }

    const metadata = metadataResult.get() as PlexTerminalMedia;

    // We're here, might as well use the real thing.
    const firstPart = first(first(metadata.Media)?.Part);

    const entities: NewSingleOrMultiExternalId[] = [
      {
        type: 'multi',
        externalFilePath: firstPart?.key ?? program.plexFilePath,
        directFilePath: firstPart?.file ?? program.filePath,
        externalKey: metadata.ratingKey,
        externalSourceId: plex.serverName,
        mediaSourceId: plex.serverId,
        programUuid: program.uuid,
        sourceType: ProgramExternalIdType.PLEX,
        uuid: v4(),
        createdAt: +dayjs(),
        updatedAt: +dayjs(),
      },
    ];

    attemptSync(() => {
      // Matched example: plex://movie/5d7768313c3c2a001fbcd1cf
      // Unmatched example: com.plexapp.agents.none://20297/2022/1499?lang=xn
      const parsed = new URL(metadata.guid);
      if (trimEnd(parsed.protocol, ':') !== 'plex') {
        return;
      }

      entities.push({
        type: 'single',
        uuid: v4(),
        createdAt: +dayjs(),
        updatedAt: +dayjs(),
        programUuid: program.uuid,
        sourceType: ProgramExternalIdType.PLEX_GUID,
        externalKey: metadata.guid,
      });
    });

    return entities;
  }
}
