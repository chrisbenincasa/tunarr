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
import dayjs from 'dayjs';
import { first, groupBy, isNil, isUndefined, keys } from 'lodash-es';
import { v4 } from 'uuid';
import { MediaSourceApiFactory } from '../../external/MediaSourceApiFactory.ts';
import { PlexApiClient } from '../../external/plex/PlexApiClient.ts';
import { isNonEmptyString, wait } from '../../util/index.ts';
import { LoggerFactory } from '../../util/logging/LoggerFactory.ts';
import { ChannelDB } from '../channelDb.ts';
import { ProgramExternalIdType } from '../custom_types/ProgramExternalIdType.ts';
import { ProgramSourceType } from '../custom_types/ProgramSourceType.ts';
import { directDbAccess } from '../direct/directDbAccess.js';
import { Program } from '../direct/schema/Program.js';
import { ProgramType } from '../direct/schema/Program.ts';
import {
  NewProgramGrouping,
  ProgramGroupingType,
} from '../direct/schema/ProgramGrouping.ts';
import { NewProgramGroupingExternalId } from '../direct/schema/ProgramGroupingExternalId.ts';
import { MediaSourceDB } from '../mediaSourceDB.ts';
import { ProgramDB } from '../programDB.js';

export class LegacyMetadataBackfiller {
  private logger = LoggerFactory.child({
    caller: import.meta,
    className: LegacyMetadataBackfiller.name,
  });

  constructor(
    private mediaSourceDB: MediaSourceDB = new MediaSourceDB(new ChannelDB()),
    private programDB: ProgramDB = new ProgramDB(),
  ) {}

  // It requires valid PlexServerSettings, program metadata, etc
  async backfillParentMetadata() {
    const missingProgramAncestors = await directDbAccess()
      .selectFrom('program')
      .selectAll()
      .where((eb) => {
        return eb.or([
          eb.and([
            eb('program.type', '=', ProgramType.Episode),
            eb.or([
              eb.and([
                eb('program.grandparentExternalKey', 'is', null),
                eb.or([eb('program.tvShowUuid', 'is', null)]),
              ]),
              eb.and([
                eb('program.parentExternalKey', 'is', null),
                eb('program.seasonUuid', 'is', null),
              ]),
            ]),
          ]),
          eb.and([
            eb('program.type', '=', ProgramType.Track),
            eb.or([
              eb.and([
                eb('program.grandparentExternalKey', 'is', null),
                eb.or([eb('program.artistUuid', 'is', null)]),
              ]),
              eb.and([
                eb('program.parentExternalKey', 'is', null),
                eb('program.albumUuid', 'is', null),
              ]),
            ]),
          ]),
        ]);
        // TODO: Support JF
      })
      .where('program.sourceType', '=', ProgramSourceType.PLEX)
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
    const server = await this.mediaSourceDB.getByName(serverName);
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
          const existingGrandparent =
            await this.programDB.getProgramGrouping(grandparentUUID);
          if (existingGrandparent) {
            this.logger.trace('Using existing grandparent grouping!');
            updatedGrandparent = true;
            await directDbAccess()
              .updateTable('program')
              .set({
                tvShowUuid:
                  type === ProgramType.Episode
                    ? existingGrandparent.uuid
                    : null,
                artistUuid:
                  type === ProgramType.Track ? existingGrandparent.uuid : null,
              })
              .where('uuid', '=', uuid)
              .execute();
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
        const existingParent =
          await this.programDB.getProgramGrouping(parentUUID);
        if (existingParent) {
          this.logger.trace('Using existing parent!');
          updatedParent = true;
          await directDbAccess()
            .updateTable('program')
            .set({
              seasonUuid:
                type === ProgramType.Episode ? existingParent.uuid : null,
              albumUuid:
                type === ProgramType.Track ? existingParent.uuid : null,
            })
            .where('uuid', '=', uuid)
            .execute();
        }
      }

      if (updatedParent && updatedGrandparent) {
        continue;
      }

      // Otherwise, we need to go and find details...
      const plex = MediaSourceApiFactory().get(server);

      // This where the types have to diverge, because the Plex
      // API types differ.

      if (type === ProgramType.Episode) {
        // Lookup the episode in Plex
        const plexResult = await plex.doGetPath<PlexEpisodeView>(
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

        if (isNonEmptyString(episode.grandparentRatingKey)) {
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
            const seasons = await plex.doGetPath<PlexSeasonView>(show.key);
            if (!isUndefined(seasons?.Metadata)) {
              for (const season of seasons.Metadata) {
                const seasonEpisodes = await plex.doGetPath<PlexEpisodeView>(
                  season.key,
                );
                if (!isUndefined(seasonEpisodes?.Metadata)) {
                  for (const episode of seasonEpisodes.Metadata) {
                    programToGrandparentMappings[episode.ratingKey] =
                      show.ratingKey;
                    programToParentMappings[episode.ratingKey] =
                      season.ratingKey;
                  }
                }
              }
            }
          }
        } else {
          this.logger.warn(
            'Episode with rating key %s has no grandparent rating key',
            episode.ratingKey,
          );
        }

        if (isNonEmptyString(episode.parentRatingKey)) {
          // Upsert season mapping
          const parentRatingKey = episode.parentRatingKey;

          const existingSeason = await this.findExistingGroupingOfType(
            server.name,
            parentRatingKey,
            ProgramGroupingType.TvShowSeason,
          );

          if (isNil(existingSeason)) {
            const seasonAndRef =
              await this.generateAncestorEntities<PlexSeasonView>(
                plex,
                episode.parentRatingKey,
                (season: PlexTvSeason) => {
                  const now = +dayjs();
                  return {
                    uuid: v4(),
                    createdAt: now,
                    updatedAt: now,
                    title: season.title,
                    type: ProgramGroupingType.TvShowSeason,
                    icon: season.thumb,
                    summary: season.summary,
                    index: season.index,
                  };
                },
              );

            if (seasonAndRef) {
              const [season, externalId] = seasonAndRef;
              parentRatingKeyToUUID[episode.parentRatingKey] = season.uuid;
              await directDbAccess()
                .transaction()
                .execute(async (tx) => {
                  const groupingId = await tx
                    .insertInto('programGrouping')
                    .values(season)
                    .returning('uuid')
                    .executeTakeFirst();
                  await tx
                    .insertInto('programGroupingExternalId')
                    .values(externalId)
                    .executeTakeFirst();
                  if (groupingId) {
                    await directDbAccess()
                      .updateTable('program')
                      .where('uuid', '=', uuid)
                      .set({ seasonUuid: groupingId?.uuid })
                      .execute();
                  }
                });
            }
          } else {
            await directDbAccess()
              .updateTable('program')
              .where('uuid', '=', uuid)
              .set({
                seasonUuid: existingSeason.uuid,
              })
              .execute();
            parentRatingKeyToUUID[episode.parentRatingKey] =
              existingSeason.groupUuid;
          }
        }

        if (isNonEmptyString(episode.grandparentRatingKey)) {
          // Upsert show mapping
          const grandparentExternalKey = episode.grandparentRatingKey;

          const existingShow = await this.findExistingGroupingOfType(
            server.name,
            grandparentExternalKey,
            ProgramGroupingType.TvShow,
          );

          if (isNil(existingShow)) {
            const showAndRef =
              await this.generateAncestorEntities<PlexLibraryShows>(
                plex,
                episode.grandparentRatingKey,
                (show: PlexTvShow) => {
                  const now = +dayjs();
                  return {
                    uuid: v4(),
                    createdAt: now,
                    updatedAt: now,
                    title: show.title,
                    type: ProgramGroupingType.TvShow,
                    icon: show.thumb,
                    summary: show.summary,
                    index: show.index,
                  };
                },
              );
            if (showAndRef) {
              const [show, externalId] = showAndRef;
              grandparentRatingKeyToUUID[episode.grandparentRatingKey] =
                show.uuid;
              await directDbAccess()
                .transaction()
                .execute(async (tx) => {
                  const groupingId = await tx
                    .insertInto('programGrouping')
                    .values(show)
                    .returning('uuid')
                    .executeTakeFirst();
                  await tx
                    .insertInto('programGroupingExternalId')
                    .values(externalId)
                    .executeTakeFirst();
                  if (groupingId) {
                    await directDbAccess()
                      .updateTable('program')
                      .where('uuid', '=', uuid)
                      .set({ tvShowUuid: groupingId?.uuid })
                      .execute();
                  }
                });
            }
          } else {
            await directDbAccess()
              .updateTable('program')
              .where('uuid', '=', uuid)
              .set({
                tvShowUuid: existingShow.uuid,
              })
              .execute();
            grandparentRatingKeyToUUID[episode.grandparentRatingKey] =
              existingShow.uuid;
          }
        }
      } else {
        // Lookup the episode in Plex
        const plexResult = await plex.doGetPath<PlexMusicTrackView>(
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

        if (isNonEmptyString(track.grandparentRatingKey)) {
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
            const albums = await plex.doGetPath<PlexMusicAlbumView>(artist.key);
            if (!isUndefined(albums?.Metadata)) {
              for (const album of albums.Metadata) {
                const albumTracks = await plex.doGetPath<PlexMusicTrackView>(
                  album.key,
                );
                if (!isUndefined(albumTracks?.Metadata)) {
                  for (const episode of albumTracks.Metadata) {
                    programToGrandparentMappings[episode.ratingKey] =
                      artist.ratingKey;
                    programToParentMappings[episode.ratingKey] =
                      album.ratingKey;
                  }
                }
              }
            }
          }
        }

        if (isNonEmptyString(track.parentRatingKey)) {
          // Upsert season mapping
          const existingAlbum = await this.findExistingGroupingOfType(
            server.name,
            track.parentRatingKey,
            ProgramGroupingType.MusicAlbum,
          );

          if (isNil(existingAlbum)) {
            const albumAndref =
              await this.generateAncestorEntities<PlexMusicAlbumView>(
                plex,
                track.parentRatingKey,
                (album) => {
                  const now = +dayjs();
                  return {
                    uuid: v4(),
                    createdAt: now,
                    updatedAt: now,
                    title: album.title,
                    type: ProgramGroupingType.MusicAlbum,
                    icon: album.thumb,
                    summary: album.summary,
                    index: album.index,
                    year: album.year,
                  };
                },
              );

            if (albumAndref) {
              const [album, externalId] = albumAndref;
              parentRatingKeyToUUID[track.parentRatingKey] = album.uuid;
              await directDbAccess()
                .transaction()
                .execute(async (tx) => {
                  const groupingId = await tx
                    .insertInto('programGrouping')
                    .values(album)
                    .returning('uuid')
                    .executeTakeFirst();
                  await tx
                    .insertInto('programGroupingExternalId')
                    .values(externalId)
                    .executeTakeFirst();

                  if (groupingId) {
                    await directDbAccess()
                      .updateTable('program')
                      .where('uuid', '=', uuid)
                      .set({ albumUuid: groupingId?.uuid })
                      .execute();
                  }
                });
            }
          } else {
            await directDbAccess()
              .updateTable('program')
              .where('uuid', '=', uuid)
              .set({
                albumUuid: existingAlbum.uuid,
              })
              .execute();
            parentRatingKeyToUUID[track.parentRatingKey] = existingAlbum.uuid;
          }
        }

        if (isNonEmptyString(track.grandparentRatingKey)) {
          // Upsert show mapping
          const existingArtist = await this.findExistingGroupingOfType(
            server.name,
            track.grandparentRatingKey,
            ProgramGroupingType.MusicArtist,
          );

          if (isNil(existingArtist)) {
            const artistAndRef =
              await this.generateAncestorEntities<PlexLibraryMusic>(
                plex,
                track.grandparentRatingKey,
                (artist: PlexMusicArtist) => {
                  const now = +dayjs();
                  return {
                    uuid: v4(),
                    createdAt: now,
                    updatedAt: now,
                    title: artist.title,
                    type: ProgramGroupingType.MusicArtist,
                    icon: artist.thumb,
                    summary: artist.summary,
                    index: artist.index,
                  };
                },
              );
            if (artistAndRef) {
              const [artist, externalId] = artistAndRef;
              grandparentRatingKeyToUUID[track.grandparentRatingKey] =
                artist.uuid;

              await directDbAccess()
                .transaction()
                .execute(async (tx) => {
                  const groupingId = await tx
                    .insertInto('programGrouping')
                    .values(artist)
                    .returning('uuid')
                    .executeTakeFirst();
                  await tx
                    .insertInto('programGroupingExternalId')
                    .values(externalId)
                    .executeTakeFirst();
                  if (groupingId) {
                    await directDbAccess()
                      .updateTable('program')
                      .where('uuid', '=', uuid)
                      .set({ artistUuid: groupingId?.uuid })
                      .execute();
                  }
                });
            }
          } else {
            await directDbAccess()
              .updateTable('program')
              .where('uuid', '=', uuid)
              .set({
                artistUuid: existingArtist.uuid,
              })
              .execute();
            grandparentRatingKeyToUUID[track.grandparentRatingKey] =
              existingArtist.uuid;
          }
        }
      }
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
    plex: PlexApiClient,
    ratingKey: string,
    cb: (item: InferredMetadataType) => NewProgramGrouping | undefined,
  ) {
    const metadata = await this.fetchPlexAncestor<
      ExpectedPlexType,
      InferredMetadataType,
      InferredPlexType
    >(plex, ratingKey);

    if (isUndefined(metadata)) {
      return;
    }

    const grouping = cb(metadata);

    // TODO use the minter here
    if (!isUndefined(grouping)) {
      const refs = {
        uuid: v4(),
        createdAt: grouping.createdAt,
        updatedAt: grouping.updatedAt,
        sourceType: ProgramExternalIdType.PLEX,
        externalSourceId: plex.serverName, // clientIdentifier would be better
        externalKey: ratingKey,
        groupUuid: grouping.uuid,
      } satisfies NewProgramGroupingExternalId;

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
  >(
    plex: PlexApiClient,
    ratingKey: string,
  ): Promise<InferredMetadataType | undefined> {
    const plexResult = await plex.doGetPath<InferredPlexType>(
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

  private findExistingGroupingOfType(
    serverName: string,
    externalKey: string,
    type: ProgramGroupingType,
  ) {
    return directDbAccess()
      .selectFrom('programGroupingExternalId')
      .selectAll()
      .where((eb) =>
        eb.and([
          eb(
            'programGroupingExternalId.sourceType',
            '=',
            ProgramExternalIdType.PLEX,
          ),
          eb('programGroupingExternalId.externalSourceId', '=', serverName),
          eb('programGroupingExternalId.externalKey', '=', externalKey),
        ]),
      )
      .innerJoin('programGrouping', (join) =>
        join
          .onRef(
            'programGrouping.uuid',
            '=',
            'programGroupingExternalId.groupUuid',
          )
          .on('programGrouping.type', '=', type),
      )
      .executeTakeFirst();
  }
}
