import { Cursor } from '@mikro-orm/core';
import { PlexEpisodeView, PlexSeasonView } from '@tunarr/types/plex';
import {
  find,
  first,
  forEach,
  groupBy,
  isNil,
  isUndefined,
  mapValues,
  pickBy,
} from 'lodash-es';
import { ProgramExternalIdType } from '../../dao/custom_types/ProgramExternalIdType.js';
import { getEm } from '../../dao/dataSource.js';
import { MediaSource } from '../../dao/entities/MediaSource.js';
import { Program, ProgramType } from '../../dao/entities/Program.js';
import {
  ProgramGrouping,
  ProgramGroupingType,
} from '../../dao/entities/ProgramGrouping.js';
import { MediaSourceApiFactory } from '../../external/MediaSourceApiFactory.js';
import { PlexApiClient } from '../../external/plex/PlexApiClient.js';
import { Maybe } from '../../types/util.js';
import { groupByUniqPropAndMap, wait } from '../../util/index.js';
import { LoggerFactory } from '../../util/logging/LoggerFactory.js';
import Fixer from './fixer.js';

export class MissingSeasonNumbersFixer extends Fixer {
  private logger = LoggerFactory.child({
    caller: import.meta,
    className: this.constructor.name,
  });

  canRunInBackground: boolean = true;

  async runInternal(): Promise<void> {
    const em = getEm();
    const allPlexServers = await em.findAll(MediaSource);

    if (allPlexServers.length === 0) {
      return;
    }

    const plexByName = groupByUniqPropAndMap(
      allPlexServers,
      'name',
      (server) => new PlexApiClient(server),
    );

    let cursor: Maybe<Cursor<Program>> = undefined;
    do {
      cursor = await em.findByCursor(
        Program,
        { seasonNumber: null, type: ProgramType.Episode },
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
          this.logger.warn('No configured server called "%s"', key);
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
                this.logger.warn(
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
                program.seasonNumber = seasonNum;
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
                program.seasonNumber = seasonNum;
                em.persist(program);
              });
            } else {
              for (const program of programs) {
                if (!program.plexRatingKey) {
                  this.logger.warn(
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
                  program.seasonNumber = seasonNum;
                  em.persist(program);
                }
              }
            }
          }
        }
      }

      await em.flush();
    } while (cursor.hasNextPage);

    const plexServers = await getEm().findAll(MediaSource);

    const seasonsMissingIndexes = await em.find(
      ProgramGrouping,
      { type: ProgramGroupingType.TvShowSeason, index: null },
      {
        populateWhere: {
          externalRefs: {
            sourceType: ProgramExternalIdType.PLEX,
          },
        },
        populate: ['externalRefs'],
      },
    );

    // Backfill missing season numbers
    for (const season of seasonsMissingIndexes) {
      const ref = season.externalRefs.$.find(
        (ref) => ref.sourceType === ProgramExternalIdType.PLEX,
      );
      if (isUndefined(ref)) {
        continue;
      }

      const server = find(
        plexServers,
        (ps) => ps.name === ref.externalSourceId,
      );
      if (isNil(server)) {
        this.logger.warn(
          'Could not find server with name %s',
          ref.externalSourceId,
        );
        continue;
      }

      const plex = MediaSourceApiFactory().get(server);
      const plexResult = await plex.doGetPath<PlexSeasonView>(
        '/library/metadata/' + ref.externalKey,
      );

      if (isNil(plexResult) || plexResult.Metadata.length < 1) {
        this.logger.warn(
          'Found no result for key %s in plex server %s',
          ref.externalKey,
          ref.externalSourceId,
        );
        continue;
      }

      const plexSeason = first(plexResult.Metadata)!;
      season.index = plexSeason.index;
      em.persist(season);
    }

    await em.flush();
  }

  private async findSeasonNumberUsingEpisode(
    episodeId: string,
    plex: PlexApiClient,
  ) {
    try {
      const episode = await plex.doGetPath<PlexEpisodeView>(
        `/library/metadata/${episodeId}`,
      );
      return episode?.parentIndex;
    } catch (e) {
      this.logger.warn(e, 'Error grabbing episode %s from plex: %O', episodeId);
      return;
    }
  }

  private async findSeasonNumberUsingParent(
    seasonId: string,
    plex: PlexApiClient,
  ) {
    // We get the parent because we're dealing with an episode and we want the
    // season index.
    try {
      const season = await plex.doGetPath<PlexSeasonView>(
        `/library/metadata/${seasonId}`,
      );
      return first(season?.Metadata ?? [])?.index;
    } catch (e) {
      this.logger.warn(e, 'Error grabbing season from plex: %O');
      return;
    }
  }
}
