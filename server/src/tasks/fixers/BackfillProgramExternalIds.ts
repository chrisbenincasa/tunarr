import {
  difference,
  first,
  forEach,
  isError,
  isUndefined,
  keys,
  trimEnd,
} from 'lodash-es';
import { ProgramExternalIdType } from '../../dao/custom_types/ProgramExternalIdType';
import { ProgramSourceType } from '../../dao/custom_types/ProgramSourceType.js';
import { getEm } from '../../dao/dataSource';
import { PlexServerSettings } from '../../dao/entities/PlexServerSettings.js';
import { Program } from '../../dao/entities/Program';
import { ProgramExternalId } from '../../dao/entities/ProgramExternalId.js';
import { Plex, PlexApiFactory, isPlexQueryError } from '../../external/plex.js';
import { Maybe } from '../../types/util.js';
import { asyncPool } from '../../util/asyncPool.js';
import { attempt, attemptSync, groupByUniq, wait } from '../../util/index.js';
import { LoggerFactory } from '../../util/logging/LoggerFactory.js';
import Fixer from './fixer';
import { PlexTerminalMedia } from '@tunarr/types/plex';
import { upsertProgramExternalIds } from '../../dao/programExternalIdHelpers';

export class BackfillProgramExternalIds extends Fixer {
  #logger = LoggerFactory.child({ caller: import.meta });

  canRunInBackground: boolean = true;

  async runInternal(): Promise<void> {
    const em = getEm();

    let cursor = await em.findByCursor(
      Program,
      {
        sourceType: ProgramSourceType.PLEX,
        externalIds: {
          $none: {
            sourceType: ProgramExternalIdType.PLEX_GUID,
          },
        },
      },
      {
        first: 100,
        populate: ['externalIds'],
        orderBy: { uuid: 'asc' },
      },
    );

    this.#logger.debug(
      'Found %d items missing plex-guid external IDs!',
      cursor.totalCount,
    );

    const plexConnections: Record<string, Plex> = {};
    while (cursor.length > 0) {
      await wait(50);
      // process
      const programs = cursor.items;

      const programsByPlexId = groupByUniq(programs, 'externalSourceId');

      const missingServers = difference(
        keys(programsByPlexId),
        keys(plexConnections),
      );

      const serverSettings = await em.find(PlexServerSettings, {
        name: { $in: missingServers },
      });

      forEach(serverSettings, (server) => {
        plexConnections[server.name] = PlexApiFactory.get(server);
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
            upsertProgramExternalIds(result.result),
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

      // next
      cursor = await em.findByCursor(
        Program,
        {
          externalIds: {
            $none: {
              sourceType: ProgramExternalIdType.PLEX_GUID,
            },
          },
        },
        {
          first: 100,
          after: cursor.endCursor ?? undefined,
          populate: ['externalIds'],
          orderBy: { uuid: 'asc' },
        },
      );
    }
  }

  private async handleProgram(program: Program, plex: Maybe<Plex>) {
    if (isUndefined(plex)) {
      throw new Error(
        'No Plex server connection found for server ' +
          program.externalSourceId,
      );
    }

    const metadataResult = await plex.getItemMetadata(program.externalKey);

    if (isPlexQueryError(metadataResult)) {
      throw new Error(
        `Could not retrieve metadata for program ID ${program.uuid}, rating key = ${program.externalKey}`,
      );
    }

    const metadata = metadataResult.data as PlexTerminalMedia;

    const em = getEm();

    // We're here, might as well use the real thing.
    const firstPart = first(first(metadata.Media)?.Part);

    const entities = [
      em.create(
        ProgramExternalId,
        {
          externalFilePath: firstPart?.key ?? program.plexFilePath,
          directFilePath: firstPart?.file ?? program.filePath,
          externalKey: metadata.ratingKey,
          externalSourceId: plex.serverName,
          program,
          sourceType: ProgramExternalIdType.PLEX,
        },
        { persist: false },
      ),
    ];

    attemptSync(() => {
      // Matched example: plex://movie/5d7768313c3c2a001fbcd1cf
      // Unmatched example: com.plexapp.agents.none://20297/2022/1499?lang=xn
      const parsed = new URL(metadata.guid);
      if (trimEnd(parsed.protocol, ':') !== 'plex') {
        return;
      }

      const eid = em.create(
        ProgramExternalId,
        {
          externalKey: metadata.guid,
          program,
          sourceType: ProgramExternalIdType.PLEX_GUID,
        },
        { persist: false },
      );

      entities.push(eid);
    });

    return entities;
  }
}
