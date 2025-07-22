import z from 'zod/v4';
import { BaseNfoParser } from './BaseNfoParser.ts';
import { NfoActor, NfoThumb, NfoUniqueId } from './NfoSchemas.ts';

export const TvEpisodeNfo = z.object({
  title: z.string(),
  originaltitle: z.string().optional(),
  sorttitle: z.string().optional(),
  userrating: z.number().optional(),
  outline: z.string().optional(),
  tagline: z.string().optional(),
  plot: z.string().optional(),
  thumb: z.array(NfoThumb).optional(),
  season: z.coerce.number().optional(),
  episode: z.coerce.number().optional(),
  mpaa: z.string().optional(),
  uniqueid: z.array(NfoUniqueId),
  genre: z.array(z.string()).optional(),
  country: z.array(z.string()).optional(),
  set: z
    .object({
      name: z.string(),
      overview: z.string(),
    })
    .optional(),
  tag: z.array(z.string()).optional(),
  credits: z.array(z.string()).optional(),
  director: z.array(z.string()).optional(),
  premiered: z.string().optional(), // yyyy-mm-dd
  aired: z.string().optional(), // yyyy-mm-dd
  studio: z.string().optional(),
  actor: z.array(NfoActor),
});

const TvEpisodeNfoContainer = z.object({
  episodedetails: z.array(TvEpisodeNfo),
});

const ArrayTags = [
  'episodedetails',
  'episodedetails.credits',
  'episodedetails.director',
  'episodedetails.genre',
  'episodedetails.country',
  'episodedetails.thumb',
  'episodedetails.fileinfo',
];

export class TvEpisodeNfoParser extends BaseNfoParser<
  typeof TvEpisodeNfoContainer
> {
  constructor() {
    super(TvEpisodeNfoContainer);
  }

  protected override get arrayTags() {
    return ArrayTags;
  }
}
