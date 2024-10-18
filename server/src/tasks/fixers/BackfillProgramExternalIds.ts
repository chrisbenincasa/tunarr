import { PlexTerminalMedia } from '@tunarr/types/plex';
import dayjs from 'dayjs';
import {
  difference,
  first,
  forEach,
  isEmpty,
  isError,
  isUndefined,
  keys,
  last,
  trimEnd,
} from 'lodash-es';
import { v4 } from 'uuid';
import { ProgramExternalIdType } from '../../dao/custom_types/ProgramExternalIdType.ts';
import { ProgramSourceType } from '../../dao/custom_types/ProgramSourceType.js';
import { directDbAccess } from '../../dao/direct/directDbAccess.ts';
import { withProgramExternalIds } from '../../dao/direct/programQueryHelpers.ts';
import { Program } from '../../dao/direct/schema/Program.ts';
import { NewProgramExternalId } from '../../dao/direct/schema/ProgramExternalId.ts';
import { upsertRawProgramExternalIds } from '../../dao/programExternalIdHelpers.ts';
import { isQueryError } from '../../external/BaseApiClient.js';
import { MediaSourceApiFactory } from '../../external/MediaSourceApiFactory.ts';
import { PlexApiClient } from '../../external/plex/PlexApiClient.js';
import { Maybe } from '../../types/util.js';
import { asyncPool } from '../../util/asyncPool.js';
import {
  attempt,
  attemptSync,
  groupByUniqProp,
  isNonEmptyString,
  wait,
} from '../../util/index.js';
import { LoggerFactory } from '../../util/logging/LoggerFactory.js';
import Fixer from './fixer.ts';

export class BackfillProgramExternalIds extends Fixer {
  #logger = LoggerFactory.child({
    caller: import.meta,
    className: this.constructor.name,
  });

  canRunInBackground: boolean = false;

  async runInternal(): Promise<void> {
    const getNextPage = (offset?: string) => {
      return directDbAccess()
        .selectFrom('program')
        .selectAll()
        .select(withProgramExternalIds)
        .where('sourceType', '=', ProgramSourceType.PLEX)
        .$if(isNonEmptyString(offset), (eb) =>
          eb.where('program.uuid', '>', offset!),
        )
        .where((eb) =>
          eb.not(
            eb.exists(
              eb
                .selectFrom('programExternalId')
                .select('programExternalId.uuid')
                .whereRef('programExternalId.programUuid', '=', 'program.uuid')
                .where(
                  'programExternalId.sourceType',
                  '=',
                  ProgramExternalIdType.PLEX_GUID,
                ),
            ),
          ),
        )
        .limit(100)
        .orderBy('program.uuid asc')
        .execute();
    };

    let programs = await getNextPage();

    const plexConnections: Record<string, PlexApiClient> = {};
    while (programs.length > 0) {
      await wait(50);
      // process
      const programsByPlexId = groupByUniqProp(programs, 'externalSourceId');

      const missingServers = difference(
        keys(programsByPlexId),
        keys(plexConnections),
      );

      const serverSettings = await directDbAccess()
        .selectFrom('mediaSource')
        .selectAll()
        .where('name', 'in', missingServers)
        .execute();

      forEach(serverSettings, (server) => {
        plexConnections[server.name] = MediaSourceApiFactory().get(server);
      });

      for await (const result of asyncPool(
        programs,
        (program) =>
          this.handleProgram(
            program,
            plexConnections[program.externalSourceId],
          ),
        { concurrency: 1, waitAfterEachMs: 50 },
      )) {
        if (result.type === 'error') {
          this.#logger.error(
            result.error,
            'Error while attempting to get external IDs for program %s',
            result.input.uuid,
          );
        } else {
          const upsertResult = await attempt(() =>
            upsertRawProgramExternalIds(result.result),
          );
          if (isError(upsertResult)) {
            this.#logger.warn(
              upsertResult,
              'Failed to upsert external IDs: %O',
              result,
            );
          }
        }
      }

      if (isEmpty(programs)) {
        // We should've done this already but let's just be safe.
        break;
      }

      programs = await getNextPage(last(programs)?.uuid);
    }
  }

  private async handleProgram(program: Program, plex: Maybe<PlexApiClient>) {
    if (isUndefined(plex)) {
      throw new Error(
        'No Plex server connection found for server ' +
          program.externalSourceId,
      );
    }

    const metadataResult = await plex.getItemMetadata(program.externalKey);

    if (isQueryError(metadataResult)) {
      throw new Error(
        `Could not retrieve metadata for program ID ${program.uuid}, rating key = ${program.externalKey}`,
      );
    }

    const metadata = metadataResult.data as PlexTerminalMedia;

    // We're here, might as well use the real thing.
    const firstPart = first(first(metadata.Media)?.Part);

    const entities: NewProgramExternalId[] = [
      {
        externalFilePath: firstPart?.key ?? program.plexFilePath,
        directFilePath: firstPart?.file ?? program.filePath,
        externalKey: metadata.ratingKey,
        externalSourceId: plex.serverName,
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
