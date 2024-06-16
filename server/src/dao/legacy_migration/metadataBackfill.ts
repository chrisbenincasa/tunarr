// This should be run after all regular entities have been migrated

import {
  PlexEpisodeView,
  PlexLibraryMusic,
  PlexLibraryShows,
  PlexMusicAlbumView,
  PlexMusicArtist,
  PlexMusicTrackView,
  PlexSeasonView,
  PlexTvSeason,
  PlexTvShow,
} from '@tunarr/types/plex';
import { first, groupBy, isNil, isNull, isUndefined, keys } from 'lodash-es';
import { Plex, PlexApiFactory } from '../../external/plex';
import { isNonEmptyString, wait } from '../../util';
import { LoggerFactory } from '../../util/logging/LoggerFactory';
import { ProgramSourceType } from '../custom_types/ProgramSourceType';
import { getEm } from '../dataSource';
import { PlexServerSettings } from '../entities/PlexServerSettings';
import { Program, ProgramType } from '../entities/Program';
import {
  ProgramGrouping,
  ProgramGroupingType,
} from '../entities/ProgramGrouping';
import { ProgramGroupingExternalId } from '../entities/ProgramGroupingExternalId';
import { ProgramExternalIdType } from '../custom_types/ProgramExternalIdType';

export class LegacyMetadataBackfiller {
  private logger = LoggerFactory.child({
    caller: import.meta,
    className: LegacyMetadataBackfiller.name,
  });

  // It requires valid PlexServerSettings, program metadata, etc
  async backfillParentMetadata() {
    const em = getEm();

    const missingProgramAncestors = await em
      .createQueryBuilder(Program)
      .select(['uuid', 'externalSourceId', 'externalKey', 'type'], true)
      .where({
        $and: [
          {
            $or: [{ type: ProgramType.Episode }, { type: ProgramType.Track }],
          },
          {
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
          },
          {
            // At the time this was written, this was the only source type
            sourceType: ProgramSourceType.PLEX,
          },
        ],
      })
      .execute();

    const programsMissingAncestorsByServer = groupBy(
      missingProgramAncestors,
      (p) => p.externalSourceId,
    );

    for (const server of keys(programsMissingAncestorsByServer)) {
      await this.handleProgramsMissingAncestors(
        server,
        programsMissingAncestorsByServer[server],
      );
    }
  }

  private async handleProgramsMissingAncestors(
    serverName: string,
    programs: Program[],
  ) {
    const em = getEm();
    const server = await em.findOne(PlexServerSettings, { name: serverName });
    if (isNil(server)) {
      this.logger.warn(
        'Could not find plex server details for server %s',
        serverName,
      );
      return;
    }

    const programToParentMappings: Record<string, string> = {};
    const parentRatingKeyToUUID: Record<string, string> = {};
    const programToGrandparentMappings: Record<string, string> = {};
    const grandparentRatingKeyToUUID: Record<string, string> = {};

    for (const { uuid, externalSourceId, externalKey, type } of programs) {
      await wait(250); // Let's not slam Plex
      if (isUndefined(server)) {
        this.logger.warn(
          'Somehow found a legacy program with an invalid plex server: %s',
          externalSourceId,
        );
        continue;
      }

      let updatedGrandparent = false;
      if (programToGrandparentMappings[externalKey]) {
        const knownShowRatingKey = programToGrandparentMappings[externalKey];
        const grandparentUUID = grandparentRatingKeyToUUID[knownShowRatingKey];
        if (isNonEmptyString(grandparentUUID)) {
          // This was inserted by another program in the list, just update
          // the mappings.
          const existingGrandparent = await em.findOne(ProgramGrouping, {
            uuid: grandparentUUID,
          });
          if (!isNull(existingGrandparent)) {
            this.logger.trace('Using existing grandparent grouping!');
            updatedGrandparent = true;
            if (type === ProgramType.Episode) {
              existingGrandparent.showEpisodes.add(
                em.getReference(Program, uuid),
              );
            } else {
              existingGrandparent.artistTracks.add(
                em.getReference(Program, uuid),
              );
            }
          }
        }
      }

      let updatedParent = false;
      if (
        programToParentMappings[externalKey] &&
        isNonEmptyString(
          parentRatingKeyToUUID[programToParentMappings[externalKey]],
        )
      ) {
        const parentUUID =
          parentRatingKeyToUUID[programToParentMappings[externalKey]];
        const existingParent = await em.findOne(ProgramGrouping, {
          uuid: parentUUID,
        });
        if (!isNull(existingParent)) {
          this.logger.trace('Using existing parent!');
          updatedParent = true;
          if (type === ProgramType.Episode) {
            existingParent.seasonEpisodes.add(em.getReference(Program, uuid));
          } else {
            existingParent.albumTracks.add(em.getReference(Program, uuid));
          }
        }
      }

      if (updatedParent && updatedGrandparent) {
        await em.flush();
        continue;
      }

      // Otherwise, we need to go and find details...
      const plex = PlexApiFactory.get(server);

      // This where the types have to diverge, because the Plex
      // API types differ.

      if (type === ProgramType.Episode) {
        // Lookup the episode in Plex
        const plexResult = await plex.doGet<PlexEpisodeView>(
          '/library/metadata/' + externalKey,
        );

        if (isNil(plexResult) || plexResult.Metadata.length < 1) {
          this.logger.warn(
            'Found no result for key %s in plex server %s',
            externalKey,
            externalSourceId,
          );
          continue;
        }

        const episode = first(plexResult.Metadata)!;

        // Attempt to create mappings for the show/seasons so that other programs
        // from this show can reuse them later.
        const show = await this.fetchPlexAncestor<PlexLibraryShows>(
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
              const seasonEpisodes = await plex.doGet<PlexEpisodeView>(
                season.key,
              );
              if (!isUndefined(seasonEpisodes?.Metadata)) {
                for (const episode of seasonEpisodes.Metadata) {
                  programToGrandparentMappings[episode.ratingKey] =
                    show.ratingKey;
                  programToParentMappings[episode.ratingKey] = season.ratingKey;
                }
              }
            }
          }
        }

        // Upsert season mapping
        const existingSeason = await em.findOne(ProgramGrouping, {
          type: ProgramGroupingType.TvShowSeason,
          externalRefs: {
            sourceType: ProgramExternalIdType.PLEX,
            externalSourceId: server.name,
            externalKey: episode.parentRatingKey,
          },
        });

        if (isNil(existingSeason)) {
          const seasonAndRef =
            await this.generateAncestorEntities<PlexSeasonView>(
              plex,
              episode.parentRatingKey,
              (season: PlexTvSeason) => {
                return em.create(ProgramGrouping, {
                  title: season.title,
                  type: ProgramGroupingType.TvShowSeason,
                  icon: season.thumb,
                  summary: season.summary,
                  index: season.index,
                });
              },
            );

          if (seasonAndRef) {
            const [season] = seasonAndRef;
            season.showEpisodes.add(em.getReference(Program, uuid));
            parentRatingKeyToUUID[episode.parentRatingKey] = season.uuid;
            em.persist(seasonAndRef);
          }
        } else {
          existingSeason.showEpisodes.add(em.getReference(Program, uuid));
          parentRatingKeyToUUID[episode.parentRatingKey] = existingSeason.uuid;
        }

        // Upsert show mapping
        const existingShow = await em.findOne(ProgramGrouping, {
          type: ProgramGroupingType.TvShow,
          externalRefs: {
            sourceType: ProgramExternalIdType.PLEX,
            externalSourceId: server.name,
            externalKey: episode.grandparentRatingKey,
          },
        });

        if (isNil(existingShow)) {
          const showAndRef =
            await this.generateAncestorEntities<PlexLibraryShows>(
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
            grandparentRatingKeyToUUID[episode.grandparentRatingKey] =
              show.uuid;
            em.persist(showAndRef);
          }
        } else {
          existingShow.showEpisodes.add(em.getReference(Program, uuid));
          grandparentRatingKeyToUUID[episode.grandparentRatingKey] =
            existingShow.uuid;
        }
      } else {
        // Lookup the episode in Plex
        const plexResult = await plex.doGet<PlexMusicTrackView>(
          '/library/metadata/' + externalKey,
        );

        if (isNil(plexResult) || plexResult.Metadata.length < 1) {
          this.logger.warn(
            'Found no result for key %s in plex server %s',
            externalKey,
            externalSourceId,
          );
          continue;
        }

        const track = first(plexResult.Metadata)!;

        // Attempt to create mappings for the show/seasons so that other programs
        // from this show can reuse them later.
        const artist = await this.fetchPlexAncestor<PlexLibraryMusic>(
          plex,
          track.grandparentRatingKey,
        );

        // Update the mappings between episode<->show and episode<->season
        // These will be used on subsequent iterations to identify matches
        // without hitting Plex.
        if (!isUndefined(artist)) {
          const albums = await plex.doGet<PlexMusicAlbumView>(artist.key);
          if (!isUndefined(albums?.Metadata)) {
            for (const album of albums.Metadata) {
              const albumTracks = await plex.doGet<PlexMusicTrackView>(
                album.key,
              );
              if (!isUndefined(albumTracks?.Metadata)) {
                for (const episode of albumTracks.Metadata) {
                  programToGrandparentMappings[episode.ratingKey] =
                    artist.ratingKey;
                  programToParentMappings[episode.ratingKey] = album.ratingKey;
                }
              }
            }
          }
        }

        // Upsert season mapping
        const existingAlbum = await em.findOne(ProgramGrouping, {
          type: ProgramGroupingType.MusicAlbum,
          externalRefs: {
            sourceType: ProgramExternalIdType.PLEX,
            externalSourceId: server.name,
            externalKey: track.parentRatingKey,
          },
        });

        if (isNil(existingAlbum)) {
          const albumAndref =
            await this.generateAncestorEntities<PlexMusicAlbumView>(
              plex,
              track.parentRatingKey,
              (album) => {
                return em.create(ProgramGrouping, {
                  title: album.title,
                  type: ProgramGroupingType.MusicAlbum,
                  icon: album.thumb,
                  summary: album.summary,
                  index: album.index,
                  year: album.year,
                });
              },
            );

          if (albumAndref) {
            const [album] = albumAndref;
            album.albumTracks.add(em.getReference(Program, uuid));
            parentRatingKeyToUUID[track.parentRatingKey] = album.uuid;
            em.persist(albumAndref);
          }
        } else {
          existingAlbum.albumTracks.add(em.getReference(Program, uuid));
          parentRatingKeyToUUID[track.parentRatingKey] = existingAlbum.uuid;
        }

        // Upsert show mapping
        const existingArtist = await em.findOne(ProgramGrouping, {
          type: ProgramGroupingType.MusicArtist,
          externalRefs: {
            sourceType: ProgramExternalIdType.PLEX,
            externalSourceId: server.name,
            externalKey: track.grandparentRatingKey,
          },
        });

        if (isNil(existingArtist)) {
          const artistAndRef =
            await this.generateAncestorEntities<PlexLibraryMusic>(
              plex,
              track.grandparentRatingKey,
              (artist: PlexMusicArtist) => {
                return em.create(ProgramGrouping, {
                  title: artist.title,
                  type: ProgramGroupingType.MusicArtist,
                  icon: artist.thumb,
                  summary: artist.summary,
                });
              },
            );
          if (artistAndRef) {
            const [artist] = artistAndRef;
            artist.artistTracks.add(em.getReference(Program, uuid));
            grandparentRatingKeyToUUID[track.grandparentRatingKey] =
              artist.uuid;
            em.persist(artistAndRef);
          }
        } else {
          existingArtist.artistTracks.add(em.getReference(Program, uuid));
          grandparentRatingKeyToUUID[track.grandparentRatingKey] =
            existingArtist.uuid;
        }
      }

      await em.flush();
    }
  }

  private async generateAncestorEntities<
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

    const metadata = await this.fetchPlexAncestor<
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
        sourceType: ProgramExternalIdType.PLEX,
        externalSourceId: plex.serverName, // clientIdentifier would be better
        externalKey: ratingKey,
        group: grouping,
      });

      return [grouping, refs] as const;
    }

    return;
  }

  private async fetchPlexAncestor<
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
      this.logger.warn(
        'Found no result for key %s in plex server %s',
        ratingKey,
      );
      return;
    }

    return first(plexResult.Metadata)!;
  }
}
