import type { Canonicalizer } from '../interfaces/Canonicalizer.ts';
import type { MovieNfo } from './NfoSchemas.ts';

class MovieNfoCanonicalizer implements Canonicalizer<MovieNfo> {
  getCanonicalId(_movie: MovieNfo): string {
    return ''; // TODO:
  }
}

export class NfoCanonicalizers {
  public static Movies = new MovieNfoCanonicalizer();
}
