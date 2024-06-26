import { EntityManager, Loaded } from '@mikro-orm/better-sqlite';
import { PlexLibraryShows, PlexSeasonView } from '@tunarr/types/plex';
import ld, {
  chunk,
  concat,
  filter,
  find,
  first,
  isEmpty,
  isNil,
  isUndefined,
  map,
  reduce,
  some,
  uniq,
} from 'lodash-es';
import { ProgramSourceType } from '../../dao/custom_types/ProgramSourceType';
import { getEm } from '../../dao/dataSource';
import { PlexServerSettings } from '../../dao/entities/PlexServerSettings';
import { Program, ProgramType } from '../../dao/entities/Program';
import {
  ProgramGrouping,
  ProgramGroupingType,
} from '../../dao/entities/ProgramGrouping';
import { ProgramGroupingExternalId } from '../../dao/entities/ProgramGroupingExternalId';
import { PlexApiFactory } from '../../external/PlexApiFactory';
import { LoggerFactory } from '../../util/logging/LoggerFactory';
import Fixer from './fixer';
import { ProgramExternalIdType } from '../../dao/custom_types/ProgramExternalIdType';

export class BackfillProgramGroupings extends Fixer {
  private logger = LoggerFactory.child({
    caller: import.meta,
    className: BackfillProgramGroupings.name,
  });

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
          sourceType: ProgramExternalIdType.PLEX,
          externalKey: grandparentExternalKey,
          externalSourceId,
        },
      });

      if (!isNil(existing)) {
        this.logger.trace('Skipping existing TV show: %s', existing.uuid);
        continue;
      }

      const server = find(plexServers, (ps) => ps.name === externalSourceId);
      if (isNil(server)) {
        this.logger.warn(
          'Could not find server with name %s',
          externalSourceId,
        );
        continue;
      }

      const plex = PlexApiFactory().get(server);
      const plexResult = await plex.doGet<PlexLibraryShows>(
        '/library/metadata/' + grandparentExternalKey,
      );

      if (isNil(plexResult) || plexResult.Metadata.length < 1) {
        this.logger.warn(
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
        sourceType: ProgramExternalIdType.PLEX,
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
        sourceType: ProgramExternalIdType.PLEX,
      })
      .execute();

    for (const { externalSourceId, parentExternalKey } of serversAndSeasons) {
      const existing = await em.findOne(ProgramGrouping, {
        type: ProgramGroupingType.TvShowSeason,
        externalRefs: {
          sourceType: ProgramExternalIdType.PLEX,
          externalKey: parentExternalKey,
          externalSourceId,
        },
      });

      if (!isNil(existing)) {
        this.logger.trace('Skipping existing season: %s', existing.uuid);
        continue;
      }

      const server = find(plexServers, (ps) => ps.name === externalSourceId);
      if (isNil(server)) {
        this.logger.warn(
          'Could not find server with name %s',
          externalSourceId,
        );
        continue;
      }

      const plex = PlexApiFactory().get(server);
      const plexResult = await plex.doGet<PlexSeasonView>(
        '/library/metadata/' + parentExternalKey,
      );

      if (isNil(plexResult) || plexResult.Metadata.length < 1) {
        this.logger.warn(
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
        sourceType: ProgramExternalIdType.PLEX,
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

    this.logger.debug('Updating %d episodes', episodes.length);

    if (!isEmpty(episodes)) {
      await this.updateEpisodes(episodes);
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

      const plex = PlexApiFactory().get(server);
      const plexResult = await plex.doGet<PlexSeasonView>(
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

  private async updateEpisodes(episodes: Loaded<Program>[]) {
    const em = getEm();
    const seasonIds = ld
      .chain(episodes)
      .map((p) => ({ sourceId: p.externalSourceId, id: p.parentExternalKey }))
      .uniqBy('id')
      .value();
    const showIds = ld
      .chain(episodes)
      .map((p) => ({
        sourceId: p.externalSourceId,
        id: p.grandparentExternalKey,
      }))
      .uniqBy('id')
      .value();

    const showAndSeasonGroupings: Loaded<
      ProgramGrouping,
      | 'externalRefs'
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
              'externalRefs',
              'seasonEpisodes.uuid',
              'seasons.uuid',
              'showEpisodes.uuid',
            ],
          },
        )),
      );
    }

    const showsToSeasons = ld
      .chain(episodes)
      .map((e) => ({
        show: e.grandparentExternalKey!,
        season: e.parentExternalKey!,
      }))
      .groupBy('show')
      .mapValues((objs) => map(objs, 'season'))
      .mapValues(uniq)
      .value();

    ld.chain(showAndSeasonGroupings)
      .filter({ type: ProgramGroupingType.TvShowSeason })
      .forEach((season) => {
        const matchingEps = ld
          .chain(episodes)
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

    ld.chain(showAndSeasonGroupings)
      .filter({ type: ProgramGroupingType.TvShow })
      .forEach((show) => {
        const matchingEps = episodes.filter((e) =>
          some(show.externalRefs, {
            externalSourceId: e.externalSourceId,
            externalKey: e.grandparentExternalKey,
          }),
        );

        const plexInfo = find(show.externalRefs, {
          sourceType: ProgramExternalIdType.PLEX,
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
