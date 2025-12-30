import { head } from 'lodash-es';
import z from 'zod/v4';
import type { Maybe } from '../types/util.ts';

export const NfoFieldWithAttrs = z.object({
  '#text': z.string(),
});

export type NfoFieldWithAttrs = z.infer<typeof NfoFieldWithAttrs>;

export const NfoThumb = NfoFieldWithAttrs.extend({
  // '@_aspect': z.enum([
  //   'banner',
  //   'clearart',
  //   'clearlogo',
  //   'discart',
  //   'keyart',
  //   'landscape',
  //   'poster',
  // ]),
  '@_aspect': z.string(),
});

export const NfoUniqueId = NfoFieldWithAttrs.extend({
  '@_type': z.string(), //z.enum(['imdb', 'tmdb', 'tvdb']),
  '@_default': z.stringbool().optional(),
});

export const NfoAudioStream = z.object({
  codec: z.string(),
  language: z.string().optional(),
  channels: z.coerce.number(),
});

export const NfoVideoStream = z.object({
  codec: z.string(),
  aspect: z.coerce.number().or(z.string()).optional(),
  width: z.coerce.number(),
  height: z.coerce.number(),
  durationinseconds: z.coerce.number().optional(),
  stereomode: z.string().optional(),
  hdrtype: z.enum(['', 'hdr10', 'dolbyvision', 'hlg']).nullish().catch(''),
});

export const NfoSubtitleStream = z.object({
  language: z.string().optional(),
});

export const NfoFileInfo = z.object({
  streamdetails: z.object({
    video: NfoVideoStream,
    audio: z.array(NfoAudioStream).or(NfoAudioStream).optional(),
    subtitle: z.array(NfoSubtitleStream).or(NfoSubtitleStream).optional(),
  }),
});

export const NfoActor = z.object({
  name: z.string(),
  role: z.string().nullish(),
  order: z.coerce.number().optional(),
  thumb: z.string().optional(),
});

export type NfoActor = z.infer<typeof NfoActor>;

export const MovieNfo = z.object({
  title: z.string(),
  originaltitle: z.string().optional(),
  sorttitle: z.string().optional(),
  userrating: z.coerce.number().optional(),
  outline: z.string().optional(),
  tagline: z.string().optional(),
  plot: z.string().optional(),
  runtime: z.coerce.number().optional(), // mins
  thumb: z.array(NfoThumb).optional(),
  mpaa: z.string().optional().catch(undefined),
  uniqueid: z.array(NfoUniqueId).optional(),
  genre: z.array(z.string()).optional(),
  country: z.array(z.string()).optional(),
  set: z
    .object({
      name: z.string(),
      overview: z.string(),
    })
    .optional()
    .catch(undefined),
  tag: z.array(z.string()).optional(),
  credits: z.array(z.string().or(NfoFieldWithAttrs)).optional(),
  director: z.array(z.string().or(NfoFieldWithAttrs)).optional(),
  premiered: z.string().optional(), // yyyy-mm-dd
  studio: z.string().optional().catch(undefined),
  fileinfo: z.array(NfoFileInfo).optional(),
  actor: z.array(NfoActor).optional(),
});

export type MovieNfo = z.infer<typeof MovieNfo>;

export const MovieNfoContainer = z.object({
  movie: MovieNfo,
});

export const TvShowNfo = z.object({
  title: z.string(),
  originaltitle: z.string().optional(),
  sorttitle: z.string().optional(),
  userrating: z.coerce.number().optional(),
  outline: z.string().optional(),
  tagline: z.string().optional(),
  plot: z.string().optional(),
  thumb: z.array(NfoThumb).optional(),
  season: z.coerce.number().optional(),
  episode: z.coerce.number().optional(),
  mpaa: z.string().optional().catch(undefined),
  uniqueid: z.array(NfoUniqueId).optional(),
  genre: z.array(z.string()).optional(),
  country: z.array(z.string()).optional(),
  set: z
    .object({
      name: z.string(),
      overview: z.string(),
    })
    .optional()
    .catch(undefined),
  tag: z.array(z.string()).optional(),
  credits: z.array(z.string().or(NfoFieldWithAttrs)).optional(),
  director: z.array(z.string().or(NfoFieldWithAttrs)).optional(),
  premiered: z.string().optional(), // yyyy-mm-dd
  enddate: z.string().optional(), // yyyy-mm-dd
  studio: z.string().optional().catch(undefined),
  actor: z.array(NfoActor).optional(),
});

export type TvShowNfo = z.infer<typeof TvShowNfo>;

export const TvShowNfoContainer = z.object({
  tvshow: TvShowNfo,
});

export const TvEpisodeNfo = z.object({
  title: z.string(),
  originaltitle: z.string().optional(),
  sorttitle: z.string().optional(),
  userrating: z.coerce.number().optional(),
  outline: z.string().optional(),
  tagline: z.string().optional(),
  plot: z.string().optional(),
  thumb: z.array(NfoThumb).optional().catch([]),
  season: z.coerce.number().optional(),
  episode: z.coerce.number().optional(),
  mpaa: z.string().optional(),
  uniqueid: z.array(NfoUniqueId).optional().catch([]),
  genre: z.array(z.string()).optional(),
  country: z.array(z.string()).optional(),
  set: z
    .object({
      name: z.string(),
      overview: z.string(),
    })
    .optional(),
  tag: z.array(z.string()).optional(),
  credits: z.array(z.string().or(NfoFieldWithAttrs)).optional(),
  director: z.array(z.string().or(NfoFieldWithAttrs)).optional(),
  premiered: z.string().optional(), // yyyy-mm-dd
  aired: z.string().optional(), // yyyy-mm-dd
  studio: z.string().optional().catch(undefined),
  actor: z.array(NfoActor).optional(),
});

export type TvEpisodeNfo = z.infer<typeof TvEpisodeNfo>;

export const TvEpisodeNfoContainer = z.object({
  episodedetails: z.array(TvEpisodeNfo),
});

export const OtherVideoNfoContainer = z
  .object({
    ...MovieNfoContainer.shape,
    ...TvEpisodeNfoContainer.shape,
  })
  .partial();

export type OtherVideoNfo = MovieNfo | TvEpisodeNfo;

export const MusicArtistNfo = z.object({
  name: z.string(),
  musicBrainzArtistID: z.string().optional().catch(undefined),
  sortname: z.string().optional(),
  genre: z.array(z.string()).optional(),
  style: z.array(z.string()).optional(),
  mood: z.array(z.string()).optional(),
  born: z.string().optional(),
  formed: z.string().optional(),
  biography: z.string().optional(),
  died: z.stringbool().optional().catch(false),
  thumb: z.array(NfoThumb).optional(),
});

export const MusicArtistNfoContainer = z.object({
  artist: MusicArtistNfo,
});

export const MusicAlbumNfo = z.object({
  title: z.string(),
  musicbrainzalbumid: z.string().optional(),
  musicbrainzreleasegroupid: z.string().optional(),
  genre: z.array(z.string()).optional(),
  style: z.array(z.string()).optional(),
  mood: z.array(z.string()).optional(),
  theme: z.array(z.string()).optional(),
  compilation: z.stringbool().optional(),
  boxset: z.stringbool().optional(),
  releasestatus: z.string().optional(),
  releasedate: z.string().optional(),
  originalreleasedate: z.string().optional(),
  label: z.string().optional(),
  thumb: z.array(NfoThumb).optional(),
});

export const MusicAlbumNfoContainer = z.object({
  album: MusicAlbumNfo,
});

export function unwrapOtherVideoNfoContainer(
  container: z.infer<typeof OtherVideoNfoContainer>,
): Maybe<OtherVideoNfo> {
  if ('movie' in container) {
    return container.movie;
  }
  return head(container.episodedetails);
}
