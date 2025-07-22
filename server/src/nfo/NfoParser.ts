import type { Result } from '../types/result.ts';

export interface NfoParser<MediaType> {
  parse(content: string): Promise<Result<MediaType>>;
}
