import type { JellyfinItem } from '@tunarr/types/jellyfin';
import type { PlexMedia } from '@tunarr/types/plex';
import { ContainerModule } from 'inversify';
import { MediaSourceType } from '../db/schema/MediaSource.ts';
import { KEYS } from '../types/inject.ts';
import type { Canonicalizer } from './Canonicalizer.ts';
import { JellyfinItemCanonicalizer } from './JellyfinItemCanonicalizer.ts';
import { PlexMediaCanonicalizer } from './PlexMediaCanonicalizers.ts';
import { JellyfinMediaSourceMovieScanner } from './scanner/JellyfinMediaSourceMovieScanner.ts';
import { JellyfinMediaSourceTvShowScanner } from './scanner/JellyfinMediaSourceTvShowScanner.ts';
import type { GenericMediaSourceMovieLibraryScanner } from './scanner/MediaSourceMovieLibraryScanner.ts';
import type { GenericMediaSourceMusicLibraryScanner } from './scanner/MediaSourceMusicArtistScanner.ts';
import { MediaSourceProgressService } from './scanner/MediaSourceProgressService.ts';
import type {
  GenericMediaSourceScanner,
  GenericMediaSourceScannerFactory,
} from './scanner/MediaSourceScanner.ts';
import type { GenericMediaSourceTvShowLibraryScanner } from './scanner/MediaSourceTvShowLibraryScanner.ts';
import { PlexMediaSourceMovieScanner } from './scanner/PlexMediaSourceMovieScanner.ts';
import { PlexMediaSourceMusicScanner } from './scanner/PlexMediaSourceMusicScanner.ts';
import { PlexMediaSourceTvShowScanner } from './scanner/PlexMediaSourceTvShowScanner.ts';

export const ServicesModule = new ContainerModule((bind) => {
  bind<Canonicalizer<PlexMedia>>(KEYS.PlexCanonicalizer)
    .to(PlexMediaCanonicalizer)
    .inSingletonScope();
  bind<Canonicalizer<JellyfinItem>>(KEYS.JellyfinCanonicalizer)
    .to(JellyfinItemCanonicalizer)
    .inSingletonScope();

  bind<PlexMediaSourceMovieScanner>(KEYS.MediaSourceMovieLibraryScanner)
    .to(PlexMediaSourceMovieScanner)
    .whenTargetNamed(MediaSourceType.Plex);
  bind<JellyfinMediaSourceMovieScanner>(KEYS.MediaSourceMovieLibraryScanner)
    .to(JellyfinMediaSourceMovieScanner)
    .whenTargetNamed(MediaSourceType.Jellyfin);

  bind<PlexMediaSourceTvShowScanner>(KEYS.MediaSourceTvShowLibraryScanner)
    .to(PlexMediaSourceTvShowScanner)
    .whenTargetNamed(MediaSourceType.Plex);
  bind<JellyfinMediaSourceTvShowScanner>(KEYS.MediaSourceTvShowLibraryScanner)
    .to(JellyfinMediaSourceTvShowScanner)
    .whenTargetNamed(MediaSourceType.Jellyfin);

  bind<PlexMediaSourceMusicScanner>(KEYS.MediaSourceMusicLibraryScanner)
    .to(PlexMediaSourceMusicScanner)
    .whenTargetNamed(MediaSourceType.Plex);

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
      case 'music_videos':
      case 'other_videos':
        throw new Error('No binding set for library type ' + libraryType);
    }
  });

  bind(MediaSourceProgressService).toSelf().inSingletonScope();
});
