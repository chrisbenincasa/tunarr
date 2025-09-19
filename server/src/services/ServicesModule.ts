import type { EmbyItem } from '@tunarr/types/emby';
import type { JellyfinItem } from '@tunarr/types/jellyfin';
import type { PlexMedia } from '@tunarr/types/plex';
import { ContainerModule } from 'inversify';
import { MediaSourceType } from '../db/schema/MediaSource.ts';
import { KEYS } from '../types/inject.ts';
import type { Canonicalizer } from './Canonicalizer.ts';
import { EmbyItemCanonicalizer } from './EmbyItemCanonicalizer.ts';
import { JellyfinItemCanonicalizer } from './JellyfinItemCanonicalizer.ts';
import { PlexMediaCanonicalizer } from './PlexMediaCanonicalizers.ts';
import { EmbyMediaSourceMovieScanner } from './scanner/EmbyMediaSourceMovieScanner.ts';
import { EmbyMediaSourceMusicScanner } from './scanner/EmbyMediaSourceMusicScanner.ts';
import { EmbyMediaSourceTvShowScanner } from './scanner/EmbyMediaSourceTvShowScanner.ts';
import { JellyfinMediaSourceMovieScanner } from './scanner/JellyfinMediaSourceMovieScanner.ts';
import { JellyfinMediaSourceMusicScanner } from './scanner/JellyfinMediaSourceMusicScanner.ts';
import { JellyfinMediaSourceOtherVideoScanner } from './scanner/JellyfinMediaSourceOtherVideoScanner.ts';
import { JellyfinMediaSourceTvShowScanner } from './scanner/JellyfinMediaSourceTvShowScanner.ts';
import type { GenericMediaSourceMovieLibraryScanner } from './scanner/MediaSourceMovieLibraryScanner.ts';
import type { GenericMediaSourceMusicLibraryScanner } from './scanner/MediaSourceMusicArtistScanner.ts';
import { MediaSourceProgressService } from './scanner/MediaSourceProgressService.ts';
import { MediaSourceScanCoordinator } from './scanner/MediaSourceScanCoordinator.ts';
import type {
  GenericMediaSourceScanner,
  GenericMediaSourceScannerFactory,
} from './scanner/MediaSourceScanner.ts';
import type { GenericMediaSourceTvShowLibraryScanner } from './scanner/MediaSourceTvShowLibraryScanner.ts';
import { PlexMediaSourceMovieScanner } from './scanner/PlexMediaSourceMovieScanner.ts';
import { PlexMediaSourceMusicScanner } from './scanner/PlexMediaSourceMusicScanner.ts';
import { PlexMediaSourceOtherVideoScanner } from './scanner/PlexMediaSourceOtherVideoScanner.ts';
import { PlexMediaSourceTvShowScanner } from './scanner/PlexMediaSourceTvShowScanner.ts';

export const ServicesModule = new ContainerModule((bind) => {
  bind<Canonicalizer<PlexMedia>>(KEYS.PlexCanonicalizer)
    .to(PlexMediaCanonicalizer)
    .inSingletonScope();
  bind<Canonicalizer<JellyfinItem>>(KEYS.JellyfinCanonicalizer)
    .to(JellyfinItemCanonicalizer)
    .inSingletonScope();
  bind<Canonicalizer<EmbyItem>>(KEYS.EmbyCanonicalizer)
    .to(EmbyItemCanonicalizer)
    .inSingletonScope();

  bind<PlexMediaSourceMovieScanner>(KEYS.MediaSourceMovieLibraryScanner)
    .to(PlexMediaSourceMovieScanner)
    .whenTargetNamed(MediaSourceType.Plex);
  bind<JellyfinMediaSourceMovieScanner>(KEYS.MediaSourceMovieLibraryScanner)
    .to(JellyfinMediaSourceMovieScanner)
    .whenTargetNamed(MediaSourceType.Jellyfin);
  bind<EmbyMediaSourceMovieScanner>(KEYS.MediaSourceMovieLibraryScanner)
    .to(EmbyMediaSourceMovieScanner)
    .whenTargetNamed(MediaSourceType.Emby);

  bind<PlexMediaSourceTvShowScanner>(KEYS.MediaSourceTvShowLibraryScanner)
    .to(PlexMediaSourceTvShowScanner)
    .whenTargetNamed(MediaSourceType.Plex);
  bind<JellyfinMediaSourceTvShowScanner>(KEYS.MediaSourceTvShowLibraryScanner)
    .to(JellyfinMediaSourceTvShowScanner)
    .whenTargetNamed(MediaSourceType.Jellyfin);
  bind<EmbyMediaSourceTvShowScanner>(KEYS.MediaSourceTvShowLibraryScanner)
    .to(EmbyMediaSourceTvShowScanner)
    .whenTargetNamed(MediaSourceType.Emby);

  bind<PlexMediaSourceMusicScanner>(KEYS.MediaSourceMusicLibraryScanner)
    .to(PlexMediaSourceMusicScanner)
    .whenTargetNamed(MediaSourceType.Plex);
  bind<JellyfinMediaSourceMusicScanner>(KEYS.MediaSourceMusicLibraryScanner)
    .to(JellyfinMediaSourceMusicScanner)
    .whenTargetNamed(MediaSourceType.Jellyfin);
  bind<EmbyMediaSourceMusicScanner>(KEYS.MediaSourceMusicLibraryScanner)
    .to(EmbyMediaSourceMusicScanner)
    .whenTargetNamed(MediaSourceType.Emby);

  bind<PlexMediaSourceOtherVideoScanner>(
    KEYS.MediaSourceOtherVideoLibraryScanner,
  )
    .to(PlexMediaSourceOtherVideoScanner)
    .whenTargetNamed(MediaSourceType.Plex);
  bind<JellyfinMediaSourceOtherVideoScanner>(
    KEYS.MediaSourceOtherVideoLibraryScanner,
  )
    .to(JellyfinMediaSourceOtherVideoScanner)
    .whenTargetNamed(MediaSourceType.Jellyfin);

  bind<GenericMediaSourceScannerFactory>(
    KEYS.MediaSourceLibraryScanner,
  ).toFactory<
    GenericMediaSourceScanner,
    Parameters<GenericMediaSourceScannerFactory>
  >((ctx) => (sourceType, libraryType) => {
    switch (libraryType) {
      case 'movies':
        return ctx.container.getNamed<GenericMediaSourceMovieLibraryScanner>(
          KEYS.MediaSourceMovieLibraryScanner,
          sourceType,
        );
      case 'shows':
        return ctx.container.getNamed<GenericMediaSourceTvShowLibraryScanner>(
          KEYS.MediaSourceTvShowLibraryScanner,
          sourceType,
        );
      case 'tracks':
        return ctx.container.getNamed<GenericMediaSourceMusicLibraryScanner>(
          KEYS.MediaSourceMusicLibraryScanner,
          sourceType,
        );
      case 'other_videos':
        return ctx.container.getNamed<GenericMediaSourceMovieLibraryScanner>(
          KEYS.MediaSourceOtherVideoLibraryScanner,
          sourceType,
        );
      case 'music_videos':
        throw new Error('No binding set for library type ' + libraryType);
    }
  });

  bind(MediaSourceProgressService).toSelf().inSingletonScope();
  bind(MediaSourceScanCoordinator).toSelf().inSingletonScope();
});
