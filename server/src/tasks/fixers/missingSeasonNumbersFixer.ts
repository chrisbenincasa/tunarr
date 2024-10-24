import { PlexEpisodeView, PlexSeasonView } from '@tunarr/types/plex';
import { CaseWhenBuilder } from 'kysely';
import {
  chunk,
  find,
  first,
  forEach,
  groupBy,
  isNil,
  isNull,
  isUndefined,
  keys,
  last,
  mapValues,
  omitBy,
  pickBy,
  reduce,
} from 'lodash-es';
import { ProgramExternalIdType } from '../../dao/custom_types/ProgramExternalIdType.js';
import { getEm } from '../../dao/dataSource.js';
import { directDbAccess } from '../../dao/direct/directDbAccess.js';
import { Program as RawProgram } from '../../dao/direct/schema/Program.js';
import { DB } from '../../dao/direct/schema/db.js';
import { MediaSourceType } from '../../dao/entities/MediaSource.js';
import { ProgramType } from '../../dao/entities/Program.js';
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
    const allPlexServers = await directDbAccess()
      .selectFrom('mediaSource')
      .where('mediaSource.type', '=', MediaSourceType.Plex)
      .selectAll()
      .execute();

    if (allPlexServers.length === 0) {
      return;
    }

    const plexByName = groupByUniqPropAndMap(
      allPlexServers,
      'name',
      (server) => new PlexApiClient(server),
    );

    const updatedPrograms: RawProgram[] = [];
    let lastId: Maybe<string> = undefined;
    do {
      const items: RawProgram[] = await directDbAccess()
        .selectFrom('program')
        .selectAll()
        .$if(!isNull(lastId), (eb) => eb.where('uuid', '>', lastId!))
        .where('seasonNumber', 'is', null)
        .where('type', '=', ProgramType.Episode)
        .orderBy('uuid asc')
        .limit(100)
        .execute();

      lastId = last(items)?.uuid;

      const programsByPlexServer = groupBy(items, 'externalSourceId');
      const goodProgramsByServer = pickBy(programsByPlexServer, (_, key) => {
        const hasKey = !!plexByName[key];
        if (!hasKey) {
          this.logger.warn('No configured server called "%s"', key);
        }
        return hasKey;
      });

      const programsByServerAndParent: Record<
        string,
        Record<string, RawProgram[]>
      > = mapValues(goodProgramsByServer, (programs) => {
        return groupBy(programs, (p) => p.parentExternalKey ?? 'unset');
      });

      for (const server in programsByServerAndParent) {
        for (const parentId in programsByServerAndParent[server]) {
          const programs = programsByServerAndParent[server][parentId];

          if (parentId === 'unset') {
            for (const program of programs) {
              if (!program.plexRatingKey) {
                this.logger.debug(
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
                updatedPrograms.push(program);
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
                updatedPrograms.push(program);
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
                  updatedPrograms.push(program);
                }
              }
            }
          }
        }
      }
    } while (lastId);

    for (const updateChunk of chunk(updatedPrograms, 50)) {
      const seasonNumberById: Record<string, number> = omitBy(
        groupByUniqPropAndMap(updateChunk, 'uuid', (p) => p.seasonNumber),
        isNull,
      );
      await directDbAccess()
        .updateTable('program')
        .set((eb) => ({
          seasonNumber: reduce(
            keys(seasonNumberById),
            (acc, curr) =>
              acc
                .when('program.uuid', '=', curr)
                .then(seasonNumberById[curr] ?? eb.ref('program.seasonNumber')),
            eb.case() as unknown as CaseWhenBuilder<
              DB,
              'program',
              unknown,
              number | null
            >,
          )
            .else(eb.ref('program.seasonNumber'))
            .end(),
        }))
        .executeTakeFirst();
    }

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
        allPlexServers,
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
