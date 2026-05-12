import type { StreamLineupProgram } from '../db/derived_types/StreamLineup.ts';
import type { MediaSourceWithRelations } from '../db/schema/derivedTypes.ts';
import type { Result } from '../types/result.ts';
import type { ProgramStreamResult } from './types.ts';

export type StreamFetchRequest = {
  server: MediaSourceWithRelations;
  lineupItem: StreamLineupProgram;
};

export interface StreamDetailsFetcher<RequestType> {
  getStream(request: RequestType): Promise<Result<ProgramStreamResult>>;
}
