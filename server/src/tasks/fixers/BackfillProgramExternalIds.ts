import { difference, first, forEach, isUndefined, keys } from 'lodash-es';
import { ProgramExternalIdType } from '../../dao/custom_types/ProgramExternalIdType';
import { ProgramSourceType } from '../../dao/custom_types/ProgramSourceType.js';
import { getEm } from '../../dao/dataSource';
import { PlexServerSettings } from '../../dao/entities/PlexServerSettings.js';
import { Program } from '../../dao/entities/Program';
import { ProgramExternalId } from '../../dao/entities/ProgramExternalId.js';
import { Plex, PlexApiFactory, isPlexQueryError } from '../../external/plex.js';
import { Maybe } from '../../types/util.js';
import { asyncPool } from '../../util/asyncPool.js';
import { groupByUniq, wait } from '../../util/index.js';
import { LoggerFactory } from '../../util/logging/LoggerFactory.js';
import Fixer from './fixer';
import { PlexTerminalMedia } from '@tunarr/types/plex';

export class BackfillProgramExternalIds extends Fixer {
  #logger = LoggerFactory.child({ caller: import.meta });

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
        2,
      )) {
        if (result.type === 'error') {
          this.#logger.error(
            result.error,
            'Error while attempting to get external IDs for program %s',
            result.input.uuid,
          );
        }
      }

      await em.flush();

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

    const ratingKeyId = em.create(ProgramExternalId, {
      externalFilePath: firstPart?.key ?? program.plexFilePath,
      directFilePath: firstPart?.file ?? program.filePath,
      externalKey: metadata.ratingKey,
      externalSourceId: plex.serverName,
      program,
      sourceType: ProgramExternalIdType.PLEX,
    });

    const guidId = em.create(ProgramExternalId, {
      externalKey: metadata.guid,
      program,
      sourceType: ProgramExternalIdType.PLEX_GUID,
    });

    program.externalIds.add([ratingKeyId, guidId]);
  }
}
