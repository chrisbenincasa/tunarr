import z from 'zod/v4';
import { BaseNfoParser } from './BaseNfoParser.ts';
import { NfoActor, NfoFileInfo, NfoThumb, NfoUniqueId } from './NfoSchemas.ts';

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
  studio: z.string().optional().catch(undefined),
  fileinfo: z.array(NfoFileInfo).optional(),
  actor: z.array(NfoActor).optional(),
});

export type MovieNfo = z.infer<typeof MovieNfo>;

const MovieNfoContainer = z.object({
  movie: MovieNfo,
});

const ArrayTags = [
  'movie.credits',
  'movie.director',
  'movie.genre',
  'movie.country',
  'movie.fileinfo',
  'movie.thumb',
  'movie.tag',
  'movie.fileinfo',
  'movie.actor',
];

export class MovieNfoParser extends BaseNfoParser<typeof MovieNfoContainer> {
  constructor() {
    super(MovieNfoContainer);
  }

  protected override get arrayTags() {
    return ArrayTags;
  }
}
