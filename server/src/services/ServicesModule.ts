import { MediaSourceType } from '@/db/schema/base.js';
import type { ProgramLike } from '@tunarr/types';
import type { EmbyItem } from '@tunarr/types/emby';
import type { JellyfinItem } from '@tunarr/types/jellyfin';
import type { PlexMedia } from '@tunarr/types/plex';
import type { Factory } from 'inversify';
import { ContainerModule } from 'inversify';
import type { MediaLibraryType } from '../db/schema/MediaSource.ts';
import { KEYS } from '../types/inject.ts';
import { bindFactoryFunc } from '../util/inject.ts';
import type { Canonicalizer } from './Canonicalizer.ts';
import { CelEvaluationService } from './CelEvaluationService.ts';
import { CustomShowSyncService } from './CustomShowSyncService.ts';
import { EmbyItemCanonicalizer } from './EmbyItemCanonicalizer.ts';
import { FeatureFlagService } from './FeatureFlagService.ts';
import { TroubleshootService } from './TroubleshootService.ts';
import { JellyfinItemCanonicalizer } from './JellyfinItemCanonicalizer.ts';
import type { FolderAndContents } from './LocalFolderCanonicalizer.ts';
import { LocalFolderCanonicalizer } from './LocalFolderCanonicalizer.ts';
import { LocalMediaCanonicalizer } from './LocalMediaCanonicalizer.ts';
import { PlexMediaCanonicalizer } from './PlexMediaCanonicalizers.ts';
import { EmbyCollectionScanner } from './scanner/EmbyCollectionScanner.ts';
import { EmbyMediaSourceMovieScanner } from './scanner/EmbyMediaSourceMovieScanner.ts';
import { EmbyMediaSourceMusicScanner } from './scanner/EmbyMediaSourceMusicScanner.ts';
import { EmbyMediaSourceMusicVideoScanner } from './scanner/EmbyMediaSourceMusicVideoScanner.ts';
import { EmbyMediaSourceOtherVideoScanner } from './scanner/EmbyMediaSourceOtherVideoScanner.ts';
import { EmbyMediaSourceTvShowScanner } from './scanner/EmbyMediaSourceTvShowScanner.ts';
import type { GenericExternalCollectionScanner } from './scanner/ExternalCollectionScanner.ts';
import type {
  GenericLocalMediaSourceScanner,
  GenericLocalMediaSourceScannerFactory,
} from './scanner/FileSystemScanner.ts';
import { JellyfinCollectionScanner } from './scanner/JellyfinCollectionScanner.ts';
import { JellyfinMediaSourceMovieScanner } from './scanner/JellyfinMediaSourceMovieScanner.ts';
import { JellyfinMediaSourceMusicScanner } from './scanner/JellyfinMediaSourceMusicScanner.ts';
import { JellyfinMediaSourceMusicVideoScanner } from './scanner/JellyfinMediaSourceMusicVideoScanner.ts';
import { JellyfinMediaSourceOtherVideoScanner } from './scanner/JellyfinMediaSourceOtherVideoScanner.ts';
import { JellyfinMediaSourceTvShowScanner } from './scanner/JellyfinMediaSourceTvShowScanner.ts';
import { LocalMovieScanner } from './scanner/LocalMovieScanner.ts';
import { LocalMusicScanner } from './scanner/LocalMusicScanner.ts';
import { LocalMusicVideoScanner } from './scanner/LocalMusicVideoScanner.ts';
import { LocalOtherVideoScanner } from './scanner/LocalOtherVideoScanner.ts';
import { LocalTvShowScanner } from './scanner/LocalTvShowScanner.ts';
import type { GenericMediaSourceMovieLibraryScanner } from './scanner/MediaSourceMovieLibraryScanner.ts';
import type { GenericMediaSourceMusicLibraryScanner } from './scanner/MediaSourceMusicArtistScanner.ts';
import type { GenericMediaSourceMusicVideoLibraryScanner } from './scanner/MediaSourceMusicVideoScanner.ts';
import type { GenericMediaSourceOtherVideoLibraryScanner } from './scanner/MediaSourceOtherVideoScanner.ts';
import { MediaSourceProgressService } from './scanner/MediaSourceProgressService.ts';
import { MediaSourceScanCoordinator } from './scanner/MediaSourceScanCoordinator.ts';
import type {
  GenericMediaSourceScanner,
  GenericMediaSourceScannerFactory,
} from './scanner/MediaSourceScanner.ts';
import type { GenericMediaSourceTvShowLibraryScanner } from './scanner/MediaSourceTvShowLibraryScanner.ts';
import { PlexCollectionScanner } from './scanner/PlexCollectionScanner.ts';
import { PlexMediaSourceMovieScanner } from './scanner/PlexMediaSourceMovieScanner.ts';
import { PlexMediaSourceMusicScanner } from './scanner/PlexMediaSourceMusicScanner.ts';
import { PlexMediaSourceOtherVideoScanner } from './scanner/PlexMediaSourceOtherVideoScanner.ts';
import { PlexMediaSourceTvShowScanner } from './scanner/PlexMediaSourceTvShowScanner.ts';
import { StreamSelectionProfileResolver } from './StreamSelectionProfileResolver.ts';

export const ServicesModule = new ContainerModule(({ bind }) => {
  bind<Canonicalizer<PlexMedia>>(KEYS.PlexCanonicalizer)
    .to(PlexMediaCanonicalizer)
    .inSingletonScope();
  bind<Canonicalizer<JellyfinItem>>(KEYS.JellyfinCanonicalizer)
    .to(JellyfinItemCanonicalizer)
    .inSingletonScope();
  bind<Canonicalizer<EmbyItem>>(KEYS.EmbyCanonicalizer)
    .to(EmbyItemCanonicalizer)
    .inSingletonScope();
  bind<Canonicalizer<FolderAndContents>>(KEYS.LocalFolderCanonicalizer)
    .to(LocalFolderCanonicalizer)
    .inSingletonScope();
  bind<Canonicalizer<ProgramLike>>(KEYS.LocalMediaCanonicalizer)
    .to(LocalMediaCanonicalizer)
    .inSingletonScope();

  bind<PlexMediaSourceMovieScanner>(KEYS.MediaSourceMovieLibraryScanner)
    .to(PlexMediaSourceMovieScanner)
    .whenNamed(MediaSourceType.Plex);
  bind<JellyfinMediaSourceMovieScanner>(KEYS.MediaSourceMovieLibraryScanner)
    .to(JellyfinMediaSourceMovieScanner)
    .whenNamed(MediaSourceType.Jellyfin);
  bind<EmbyMediaSourceMovieScanner>(KEYS.MediaSourceMovieLibraryScanner)
    .to(EmbyMediaSourceMovieScanner)
    .whenNamed(MediaSourceType.Emby);

  bind<PlexMediaSourceTvShowScanner>(KEYS.MediaSourceTvShowLibraryScanner)
    .to(PlexMediaSourceTvShowScanner)
    .whenNamed(MediaSourceType.Plex);
  bind<JellyfinMediaSourceTvShowScanner>(KEYS.MediaSourceTvShowLibraryScanner)
    .to(JellyfinMediaSourceTvShowScanner)
    .whenNamed(MediaSourceType.Jellyfin);
  bind<EmbyMediaSourceTvShowScanner>(KEYS.MediaSourceTvShowLibraryScanner)
    .to(EmbyMediaSourceTvShowScanner)
    .whenNamed(MediaSourceType.Emby);

  bind<PlexMediaSourceMusicScanner>(KEYS.MediaSourceMusicLibraryScanner)
    .to(PlexMediaSourceMusicScanner)
    .whenNamed(MediaSourceType.Plex);
  bind<JellyfinMediaSourceMusicScanner>(KEYS.MediaSourceMusicLibraryScanner)
    .to(JellyfinMediaSourceMusicScanner)
    .whenNamed(MediaSourceType.Jellyfin);
  bind<EmbyMediaSourceMusicScanner>(KEYS.MediaSourceMusicLibraryScanner)
    .to(EmbyMediaSourceMusicScanner)
    .whenNamed(MediaSourceType.Emby);

  bind<PlexMediaSourceOtherVideoScanner>(
    KEYS.MediaSourceOtherVideoLibraryScanner,
  )
    .to(PlexMediaSourceOtherVideoScanner)
    .whenNamed(MediaSourceType.Plex);
  bind<JellyfinMediaSourceOtherVideoScanner>(
    KEYS.MediaSourceOtherVideoLibraryScanner,
  )
    .to(JellyfinMediaSourceOtherVideoScanner)
    .whenNamed(MediaSourceType.Jellyfin);
  bind<EmbyMediaSourceOtherVideoScanner>(
    KEYS.MediaSourceOtherVideoLibraryScanner,
  )
    .to(EmbyMediaSourceOtherVideoScanner)
    .whenNamed(MediaSourceType.Emby);

  bind<JellyfinMediaSourceMusicVideoScanner>(
    KEYS.MediaSourceMusicVideoLibraryScanner,
  )
    .to(JellyfinMediaSourceMusicVideoScanner)
    .whenNamed(MediaSourceType.Jellyfin);
  bind<EmbyMediaSourceMusicVideoScanner>(
    KEYS.MediaSourceMusicVideoLibraryScanner,
  )
    .to(EmbyMediaSourceMusicVideoScanner)
    .whenNamed(MediaSourceType.Emby);

  bind<CustomShowSyncService>(CustomShowSyncService)
    .toSelf()
    .inSingletonScope();

  bind<
    Factory<
      GenericMediaSourceScanner,
      Parameters<GenericMediaSourceScannerFactory>
    >
  >(KEYS.MediaSourceLibraryScanner).toFactory(
    (ctx) => (sourceType, libraryType) => {
      switch (libraryType) {
        case 'movies':
          return ctx.get<GenericMediaSourceMovieLibraryScanner>(
            KEYS.MediaSourceMovieLibraryScanner,
            { name: sourceType },
          );
        case 'shows':
          return ctx.get<GenericMediaSourceTvShowLibraryScanner>(
            KEYS.MediaSourceTvShowLibraryScanner,
            { name: sourceType },
          );
        case 'tracks':
          return ctx.get<GenericMediaSourceMusicLibraryScanner>(
            KEYS.MediaSourceMusicLibraryScanner,
            { name: sourceType },
          );
        case 'other_videos':
          return ctx.get<GenericMediaSourceOtherVideoLibraryScanner>(
            KEYS.MediaSourceOtherVideoLibraryScanner,
            { name: sourceType },
          );
        case 'music_videos':
          return ctx.get<GenericMediaSourceMusicVideoLibraryScanner>(
            KEYS.MediaSourceMusicVideoLibraryScanner,
            { name: sourceType },
          );
      }
    },
  );

  bind<
    Factory<
      GenericLocalMediaSourceScanner,
      Parameters<GenericLocalMediaSourceScannerFactory>
    >
  >(KEYS.LocalMediaSourceScanner).toFactory(
    (ctx) =>
      (libraryType: MediaLibraryType): GenericLocalMediaSourceScanner => {
        switch (libraryType) {
          case 'movies':
            return ctx.get<LocalMovieScanner>(LocalMovieScanner);
          case 'shows':
            return ctx.get<LocalTvShowScanner>(LocalTvShowScanner);
          case 'other_videos':
            return ctx.get<LocalOtherVideoScanner>(LocalOtherVideoScanner);
          case 'tracks':
            return ctx.get<LocalMusicScanner>(LocalMusicScanner);
          case 'music_videos':
            return ctx.get<LocalMusicVideoScanner>(LocalMusicVideoScanner);
        }
      },
  );

  bind<GenericExternalCollectionScanner>(KEYS.ExternalCollectionScanner)
    .to(PlexCollectionScanner)
    .whenNamed(MediaSourceType.Plex);

  bind<GenericExternalCollectionScanner>(KEYS.ExternalCollectionScanner)
    .to(JellyfinCollectionScanner)
    .whenNamed(MediaSourceType.Jellyfin);

  bind<GenericExternalCollectionScanner>(KEYS.ExternalCollectionScanner)
    .to(EmbyCollectionScanner)
    .whenNamed(MediaSourceType.Emby);

  bindFactoryFunc(
    bind,
    KEYS.ExternalCollectionScannerFactory,
    (ctx) => (mediaSourceType: MediaSourceType) => {
      return ctx.get<GenericExternalCollectionScanner>(
        KEYS.ExternalCollectionScanner,
        { name: mediaSourceType, optional: true },
      );
    },
  );

  bind(MediaSourceProgressService).toSelf().inSingletonScope();
  bind(MediaSourceScanCoordinator).toSelf().inSingletonScope();

  bind(CelEvaluationService).toSelf().inSingletonScope();
  bind(StreamSelectionProfileResolver).toSelf().inSingletonScope();
  bind(FeatureFlagService).toSelf().inSingletonScope();
  bind(TroubleshootService).toSelf().inSingletonScope();
});
