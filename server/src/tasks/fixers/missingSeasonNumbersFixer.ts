import { Cursor } from '@mikro-orm/core';
import { PlexEpisodeView, PlexSeasonView } from '@tunarr/types/plex';
import { first, forEach, groupBy, mapValues, pickBy } from 'lodash-es';
import { EntityManager } from '../../dao/dataSource.js';
import { PlexServerSettings } from '../../dao/entities/PlexServerSettings.js';
import { Program, ProgramType } from '../../dao/entities/Program.js';
import { logger } from '../../dao/legacyDbMigration.js';
import { Plex } from '../../plex.js';
import { Maybe } from '../../types.js';
import { groupByUniqAndMap, wait } from '../../util.js';
import Fixer from './fixer.js';

export class MissingSeasonNumbersFixer extends Fixer {
  async runInternal(em: EntityManager): Promise<void> {
    const allPlexServers = await em.findAll(PlexServerSettings);

    if (allPlexServers.length === 0) {
      return;
    }

    const plexByName = groupByUniqAndMap(
      allPlexServers,
      'name',
      (server) => new Plex(server),
    );

    let cursor: Maybe<Cursor<Program>> = undefined;
    do {
      cursor = await em.findByCursor(
        Program,
        { season: null, type: ProgramType.Episode },
        {
          first: 25,
          orderBy: { uuid: 'desc' },
          after: cursor,
        },
      );
      const programsByPlexServer = groupBy(cursor.items, 'externalSourceId');
      const goodProgramsByServer = pickBy(programsByPlexServer, (_, key) => {
        const hasKey = !!plexByName[key];
        if (!hasKey) {
          logger.warn('No configured server called "%s"', key);
        }
        return hasKey;
      });

      const programsByServerAndParent: Record<
        string,
        Record<string, Program[]>
      > = mapValues(goodProgramsByServer, (programs) => {
        return groupBy(programs, (p) => p.parentExternalKey ?? 'unset');
      });

      for (const server in programsByServerAndParent) {
        for (const parentId in programsByServerAndParent[server]) {
          const programs = programsByServerAndParent[server][parentId];

          if (parentId === 'unset') {
            for (const program of programs) {
              if (!program.plexRatingKey) {
                logger.warn(
                  `Uh-oh, we're missing a plex rating key for %s`,
                  program.uuid,
                );
                continue;
              }

              const seasonNum = await this.findSeasonNumberUsingEpisode(
                program.plexRatingKey,
                plexByName[server],
              );

              await wait(100);

              if (seasonNum) {
                program.season = seasonNum;
                em.persist(program);
              }
            }
          } else {
            const seasonNum = await this.findSeasonNumberUsingParent(
              parentId,
              plexByName[server],
            );
            await wait(100);

            if (seasonNum) {
              forEach(programs, (program) => {
                program.season = seasonNum;
                em.persist(program);
              });
            } else {
              for (const program of programs) {
                if (!program.plexRatingKey) {
                  logger.warn(
                    `Uh-oh, we're missing a plex rating key for %s`,
                    program.uuid,
                  );
                  continue;
                }

                const seasonNum = await this.findSeasonNumberUsingEpisode(
                  program.plexRatingKey,
                  plexByName[server],
                );

                await wait(100);

                if (seasonNum) {
                  program.season = seasonNum;
                  em.persist(program);
                }
              }
            }
          }
        }
      }

      await em.flush();
    } while (cursor.hasNextPage);
  }

  private async findSeasonNumberUsingEpisode(episodeId: string, plex: Plex) {
    try {
      const episode = await plex.doGet<PlexEpisodeView>(
        `/library/metadata/${episodeId}`,
      );
      return episode?.parentIndex;
    } catch (e) {
      logger.warn('Error grabbing episode %s from plex: %O', episodeId, e);
      return;
    }
  }

  private async findSeasonNumberUsingParent(seasonId: string, plex: Plex) {
    // We get the parent because we're dealing with an episode and we want the
    // season index.
    try {
      const season = await plex.doGet<PlexSeasonView>(
        `/library/metadata/${seasonId}`,
      );
      return first(season?.Metadata ?? [])?.index;
    } catch (e) {
      logger.warn('Error grabbing season from plex: %O', e);
      return;
    }
  }
}
