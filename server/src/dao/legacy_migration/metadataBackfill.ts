// This should be run after all regular entities have been migrated

import {
  PlexEpisodeView,
  PlexLibraryShows,
  PlexSeasonView,
  PlexTvSeason,
  PlexTvShow,
} from '@tunarr/types/plex';
import { first, isNil, isNull, isUndefined } from 'lodash-es';
import createLogger from '../../logger';
import { Plex, PlexApiFactory } from '../../plex';
import { groupByUniq, isNonEmptyString, wait } from '../../util';
import { ProgramSourceType } from '../custom_types/ProgramSourceType';
import { getEm } from '../dataSource';
import { PlexServerSettings } from '../entities/PlexServerSettings';
import { Program, ProgramType } from '../entities/Program';
import {
  ProgramGrouping,
  ProgramGroupingType,
} from '../entities/ProgramGrouping';
import { ProgramGroupingExternalId } from '../entities/ProgramGroupingExternalId';

const logger = createLogger(import.meta);

// It requires valid PlexServerSettings, program metadata, etc
export async function backfillParentMetadata() {
  const em = getEm();
  const allServers = groupByUniq(await em.findAll(PlexServerSettings), 'name');

  const missingAncestors = await em
    .createQueryBuilder(Program)
    .select(['uuid', 'externalSourceId', 'externalKey'], true)
    .where({
      type: ProgramType.Episode,
      // This will probably be all items during legacy migration...
      $or: [
        {
          grandparentExternalKey: null,
          tvShow: null,
        },
        {
          parentExternalKey: null,
          season: null,
        },
      ],

      // At the time this was written, this was the only source type
      sourceType: ProgramSourceType.PLEX,
    })
    .execute();

  const episodeToSeasonMappings: Record<string, string> = {};
  const seasonRatingKeyToUUID: Record<string, string> = {};
  const episodeToShowMappings: Record<string, string> = {};
  const showRatingKeyToUUID: Record<string, string> = {};

  for (const { uuid, externalSourceId, externalKey } of missingAncestors) {
    await wait(250); // Let's not slam Plex
    const server = allServers[externalSourceId];
    if (isUndefined(server)) {
      logger.warn(
        'Somehow found a legacy program with an invalid plex server: %s',
        externalSourceId,
      );
      continue;
    }

    let updatedShow = false;
    if (episodeToShowMappings[externalKey]) {
      const knownShowRatingKey = episodeToShowMappings[externalKey];
      const showUUID = showRatingKeyToUUID[knownShowRatingKey];
      if (isNonEmptyString(showUUID)) {
        // This was inserted by another program in the list, just update
        // the mappings.
        const existingShow = await em.findOne(ProgramGrouping, {
          uuid: showUUID,
        });
        if (!isNull(existingShow)) {
          logger.debug('Using existing show!');
          updatedShow = true;
          existingShow.showEpisodes.add(em.getReference(Program, uuid));
        }
      }
    }

    let updatedSeason = false;
    if (
      episodeToSeasonMappings[externalKey] &&
      isNonEmptyString(
        seasonRatingKeyToUUID[episodeToSeasonMappings[externalKey]],
      )
    ) {
      const seasonUUID =
        seasonRatingKeyToUUID[episodeToSeasonMappings[externalKey]];
      const existingSeason = await em.findOne(ProgramGrouping, {
        uuid: seasonUUID,
      });
      if (!isNull(existingSeason)) {
        logger.debug('Using existing season!');
        updatedSeason = true;
        existingSeason.seasonEpisodes.add(em.getReference(Program, uuid));
      }
    }

    if (updatedSeason && updatedShow) {
      await em.flush();
      continue;
    }

    // Otherwise, we need to go and find details...
    const plex = PlexApiFactory.get(server);

    // Lookup the episode in Plex
    const plexResult = await plex.doGet<PlexEpisodeView>(
      '/library/metadata/' + externalKey,
    );

    if (isNil(plexResult) || plexResult.Metadata.length < 1) {
      logger.warn(
        'Found no result for key %s in plex server %s',
        externalKey,
        externalSourceId,
      );
      continue;
    }

    const episode = first(plexResult.Metadata)!;

    // Attempt to create mappings for the show/seasons so that other programs
    // from this show can reuse them later.
    const show = await fetchPlexAncestor<PlexLibraryShows>(
      plex,
      episode.grandparentRatingKey,
    );

    // Update the mappings between episode<->show and episode<->season
    // These will be used on subsequent iterations to identify matches
    // without hitting Plex.
    if (!isUndefined(show)) {
      const seasons = await plex.doGet<PlexSeasonView>(show.key);
      if (!isUndefined(seasons?.Metadata)) {
        for (const season of seasons.Metadata) {
          const seasonEpisodes = await plex.doGet<PlexEpisodeView>(season.key);
          if (!isUndefined(seasonEpisodes?.Metadata)) {
            for (const episode of seasonEpisodes.Metadata) {
              episodeToShowMappings[episode.ratingKey] = show.ratingKey;
              episodeToSeasonMappings[episode.ratingKey] = season.ratingKey;
            }
          }
        }
      }
    }

    // Upsert season mapping
    const existingSeason = await em.findOne(ProgramGrouping, {
      type: ProgramGroupingType.TvShowSeason,
      externalRefs: {
        sourceType: ProgramSourceType.PLEX,
        externalSourceId: server.name,
        externalKey: episode.parentRatingKey,
      },
    });

    if (isNil(existingSeason)) {
      const seasonAndRef = await generateAncestorEntities<PlexSeasonView>(
        plex,
        episode.parentRatingKey,
        (season: PlexTvSeason) => {
          return em.create(ProgramGrouping, {
            title: season.title,
            type: ProgramGroupingType.TvShowSeason,
            icon: season.thumb,
            summary: season.summary,
          });
        },
      );

      if (seasonAndRef) {
        const [season] = seasonAndRef;
        season.showEpisodes.add(em.getReference(Program, uuid));
        seasonRatingKeyToUUID[episode.parentRatingKey] = season.uuid;
        em.persist(seasonAndRef);
      }
    } else {
      existingSeason.showEpisodes.add(em.getReference(Program, uuid));
      seasonRatingKeyToUUID[episode.parentRatingKey] = existingSeason.uuid;
    }

    // Upsert show mapping
    const existingShow = await em.findOne(ProgramGrouping, {
      type: ProgramGroupingType.TvShow,
      externalRefs: {
        sourceType: ProgramSourceType.PLEX,
        externalSourceId: server.name,
        externalKey: episode.grandparentRatingKey,
      },
    });

    if (isNil(existingShow)) {
      const showAndRef = await generateAncestorEntities<PlexLibraryShows>(
        plex,
        episode.grandparentRatingKey,
        (show: PlexTvShow) => {
          return em.create(ProgramGrouping, {
            title: show.title,
            type: ProgramGroupingType.TvShow,
            icon: show.thumb,
            summary: show.summary,
            year: show.year,
          });
        },
      );
      if (showAndRef) {
        const [show] = showAndRef;
        show.showEpisodes.add(em.getReference(Program, uuid));
        showRatingKeyToUUID[episode.grandparentRatingKey] = show.uuid;
        em.persist(showAndRef);
      }
    } else {
      existingShow.showEpisodes.add(em.getReference(Program, uuid));
      showRatingKeyToUUID[episode.grandparentRatingKey] = existingShow.uuid;
    }

    await em.flush();
  }
}

async function generateAncestorEntities<
  ExpectedPlexType extends { Metadata: unknown[] } = { Metadata: unknown[] },
  InferredMetadataType = ExpectedPlexType extends { Metadata: infer M }
    ? M extends Array<infer M0>
      ? M0
      : never
    : never,
  InferredPlexType extends { Metadata: InferredMetadataType[] } = {
    Metadata: InferredMetadataType[];
  },
>(
  plex: Plex,
  ratingKey: string,
  cb: (item: InferredMetadataType) => ProgramGrouping | undefined,
) {
  const em = getEm();

  const metadata = await fetchPlexAncestor<
    ExpectedPlexType,
    InferredMetadataType,
    InferredPlexType
  >(plex, ratingKey);

  if (isUndefined(metadata)) {
    return;
  }

  const grouping = cb(metadata);

  if (!isUndefined(grouping)) {
    const refs = em.create(ProgramGroupingExternalId, {
      sourceType: ProgramSourceType.PLEX,
      externalSourceId: plex.serverName, // clientIdentifier would be better
      externalKey: ratingKey,
      group: grouping,
    });

    return [grouping, refs] as const;
  }

  return;
}

async function fetchPlexAncestor<
  ExpectedPlexType extends { Metadata: unknown[] } = { Metadata: unknown[] },
  InferredMetadataType = ExpectedPlexType extends { Metadata: infer M }
    ? M extends Array<infer M0>
      ? M0
      : never
    : never,
  InferredPlexType extends { Metadata: InferredMetadataType[] } = {
    Metadata: InferredMetadataType[];
  },
>(plex: Plex, ratingKey: string): Promise<InferredMetadataType | undefined> {
  const plexResult = await plex.doGet<InferredPlexType>(
    '/library/metadata/' + ratingKey,
  );

  if (isNil(plexResult) || plexResult.Metadata.length < 1) {
    logger.warn('Found no result for key %s in plex server %s', ratingKey);
    return;
  }

  return first(plexResult.Metadata)!;
}
