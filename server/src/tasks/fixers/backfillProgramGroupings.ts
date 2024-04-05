import { EntityManager, Loaded } from '@mikro-orm/better-sqlite';
import { PlexLibraryShows, PlexSeasonView } from '@tunarr/types/plex';
import {
  chain,
  chunk,
  concat,
  filter,
  find,
  first,
  isEmpty,
  isNil,
  map,
  reduce,
  some,
  uniq,
} from 'lodash-es';
import { ProgramSourceType } from '../../dao/custom_types/ProgramSourceType';
import { PlexServerSettings } from '../../dao/entities/PlexServerSettings';
import { Program, ProgramType } from '../../dao/entities/Program';
import {
  ProgramGrouping,
  ProgramGroupingType,
} from '../../dao/entities/ProgramGrouping';
import { ProgramGroupingExternalId } from '../../dao/entities/ProgramGroupingExternalId';
import createLogger from '../../logger';
import { PlexApiFactory } from '../../plex';
import Fixer from './fixer';
const logger = createLogger(import.meta);

export class BackfillProgramGroupings extends Fixer {
  protected async runInternal(em: EntityManager): Promise<void> {
    const plexServers = await em.findAll(PlexServerSettings);

    // Update shows first, then seasons, so we can relate them
    const serversAndShows = await em
      .createQueryBuilder(Program)
      .select(['externalSourceId', 'grandparentExternalKey'], true)
      .where({
        type: ProgramType.Episode,
        grandparentExternalKey: { $ne: null },
        tvShow: null,
        // At the time this was written, this was the only source type
        sourceType: ProgramSourceType.PLEX,
      })
      .execute();

    for (const {
      externalSourceId,
      grandparentExternalKey,
    } of serversAndShows) {
      const existing = await em.findOne(ProgramGrouping, {
        type: ProgramGroupingType.TvShow,
        externalRefs: {
          sourceType: ProgramSourceType.PLEX,
          externalKey: grandparentExternalKey,
          externalSourceId,
        },
      });

      if (!isNil(existing)) {
        logger.log('silly', 'Skipping existing TV show: %s', existing.uuid);
        continue;
      }

      const server = find(plexServers, (ps) => ps.name === externalSourceId);
      if (isNil(server)) {
        logger.warn('Could not find server with name %s', externalSourceId);
        continue;
      }

      const plex = PlexApiFactory.get(server);
      const plexResult = await plex.doGet<PlexLibraryShows>(
        '/library/metadata/' + grandparentExternalKey,
      );

      if (isNil(plexResult) || plexResult.Metadata.length < 1) {
        logger.warn(
          'Found no result for key %s in plex server %s',
          grandparentExternalKey,
          externalSourceId,
        );
        continue;
      }

      const show = first(plexResult.Metadata)!;

      const grouping = em.create(ProgramGrouping, {
        title: show.title,
        type: ProgramGroupingType.TvShow,
        icon: show.thumb,
        summary: show.summary,
        year: show.year,
      });

      const refs = em.create(ProgramGroupingExternalId, {
        sourceType: ProgramSourceType.PLEX,
        externalSourceId: server.name, // clientIdentifier would be better
        externalKey: show.ratingKey,
        group: grouping,
      });

      em.persist([grouping, refs]);
    }

    const serversAndSeasons = await em
      .createQueryBuilder(Program)
      .select(['externalSourceId', 'parentExternalKey'], true)
      .where({
        type: ProgramType.Episode,
        parentExternalKey: { $ne: null },
        season: null,
        // At the time this was written, this was the only source type
        sourceType: ProgramSourceType.PLEX,
      })
      .execute();

    for (const { externalSourceId, parentExternalKey } of serversAndSeasons) {
      const existing = await em.findOne(ProgramGrouping, {
        type: ProgramGroupingType.TvShowSeason,
        externalRefs: {
          sourceType: ProgramSourceType.PLEX,
          externalKey: parentExternalKey,
          externalSourceId,
        },
      });

      if (!isNil(existing)) {
        logger.log('silly', 'Skipping existing season: %s', existing.uuid);
        continue;
      }

      const server = find(plexServers, (ps) => ps.name === externalSourceId);
      if (isNil(server)) {
        logger.warn('Could not find server with name %s', externalSourceId);
        continue;
      }

      const plex = PlexApiFactory.get(server);
      const plexResult = await plex.doGet<PlexSeasonView>(
        '/library/metadata/' + parentExternalKey,
      );

      if (isNil(plexResult) || plexResult.Metadata.length < 1) {
        logger.warn(
          'Found no result for key %s in plex server %s',
          parentExternalKey,
          externalSourceId,
        );
        continue;
      }

      const season = first(plexResult.Metadata)!;

      const grouping = em.create(ProgramGrouping, {
        title: season.title,
        type: ProgramGroupingType.TvShowSeason,
        icon: season.thumb,
        summary: season.summary,
      });

      const refs = em.create(ProgramGroupingExternalId, {
        sourceType: ProgramSourceType.PLEX,
        externalSourceId: server.name, // clientIdentifier would be better
        externalKey: season.ratingKey,
        group: grouping,
      });

      em.persist([grouping, refs]);
    }

    await em.flush();

    // Now let's do all of the relations...
    // First associate shows and seasons

    const episodes = await em.find(
      Program,
      {
        type: ProgramType.Episode,
        parentExternalKey: { $ne: null },
        grandparentExternalKey: { $ne: null },
        $or: [
          {
            season: null,
          },
          {
            tvShow: null,
          },
        ],
      },
      {
        orderBy: { uuid: 'desc' },
      },
    );

    logger.debug('Updateing %d episodes', episodes.length);

    if (isEmpty(episodes)) {
      return;
    }

    const seasonIds = chain(episodes)
      .map((p) => ({ sourceId: p.externalSourceId, id: p.parentExternalKey }))
      .uniqBy('id')
      .value();
    const showIds = chain(episodes)
      .map((p) => ({
        sourceId: p.externalSourceId,
        id: p.grandparentExternalKey,
      }))
      .uniqBy('id')
      .value();

    const showAndSeasonGroupings: Loaded<
      ProgramGrouping,
      | 'externalRefs.*'
      | 'seasonEpisodes.uuid'
      | 'seasons.uuid'
      | 'showEpisodes.uuid',
      '*',
      never
    >[] = [];

    for (const idChunk of chunk(concat(seasonIds, showIds), 50)) {
      showAndSeasonGroupings.push(
        ...(await em.find(
          ProgramGrouping,
          {
            $or: reduce(
              idChunk,
              (prev, { sourceId, id }) => [
                ...prev,
                {
                  externalRefs: { externalKey: id, externalSourceId: sourceId },
                },
              ],
              [],
            ),
          },
          {
            populate: [
              'externalRefs.*',
              'seasonEpisodes.uuid',
              'seasons.uuid',
              'showEpisodes.uuid',
            ],
          },
        )),
      );
    }

    const showsToSeasons = chain(episodes)
      .map((e) => ({
        show: e.grandparentExternalKey!,
        season: e.parentExternalKey!,
      }))
      .groupBy('show')
      .mapValues((objs) => map(objs, 'season'))
      .mapValues(uniq)
      .value();

    chain(showAndSeasonGroupings)
      .filter({ type: ProgramGroupingType.TvShowSeason })
      .forEach((season) => {
        const matchingEps = chain(episodes)
          .filter((e) =>
            some(season.externalRefs, {
              externalSourceId: e.externalSourceId,
              externalKey: e.parentExternalKey,
            }),
          )
          .map('uuid')
          .value();

        season.seasonEpisodes.remove((p) => matchingEps.includes(p.uuid));
        season.seasonEpisodes.add(
          map(matchingEps, (ep) => em.getReference(Program, ep)),
        );

        em.persist(season);
      })
      .value();

    chain(showAndSeasonGroupings)
      .filter({ type: ProgramGroupingType.TvShow })
      .forEach((show) => {
        const matchingEps = episodes.filter((e) =>
          some(show.externalRefs, {
            externalSourceId: e.externalSourceId,
            externalKey: e.grandparentExternalKey,
          }),
        );

        const plexInfo = find(show.externalRefs, {
          sourceType: ProgramSourceType.PLEX,
        });
        if (plexInfo) {
          const seasonIds = showsToSeasons[plexInfo.externalKey];
          const matchingSeasons = filter(
            showAndSeasonGroupings,
            (g) =>
              g.type === ProgramGroupingType.TvShowSeason &&
              some(
                g.externalRefs,
                (ref) =>
                  ref.externalSourceId === plexInfo.externalSourceId &&
                  seasonIds.includes(ref.externalKey),
              ),
          );
          const matchingSeasonIds = map(matchingSeasons, 'uuid');
          show.seasons.remove((s) => matchingSeasonIds.includes(s.uuid));
          show.seasons.add(matchingSeasons);
        }

        // Should be safe because in theory no real users are going to
        // run this
        show.showEpisodes.set(matchingEps);

        em.persist(show);
      })
      .value();

    await em.flush();
  }
}
