import z from 'zod/v4';
import { BaseNfoParser } from './BaseNfoParser.ts';
import { NfoActor, NfoThumb, NfoUniqueId } from './NfoSchemas.ts';

export const TvShowNfo = z.object({
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
  mpaa: z.string().optional().catch(undefined),
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
  enddate: z.string().optional(), // yyyy-mm-dd
  studio: z.string().optional().catch(undefined),
  actor: z.array(NfoActor).optional(),
});

export type TvShowNfo = z.infer<typeof TvShowNfo>;

const TvShowNfoContainer = z.object({
  tvshow: TvShowNfo,
});

const ArrayTags = [
  'tvshow.credits',
  'tvshow.director',
  'tvshow.genre',
  'tvshow.country',
  'tvshow.fileinfo',
  'tvshow.thumb',
  'tvshow.tag',
  'tvshow.actor',
];

export class TvShowNfoParser extends BaseNfoParser<typeof TvShowNfoContainer> {
  constructor() {
    super(TvShowNfoContainer);
  }

  protected override get arrayTags() {
    return ArrayTags;
  }
}
