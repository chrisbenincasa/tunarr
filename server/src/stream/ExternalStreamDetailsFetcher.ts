import type { StreamLineupProgram } from '../db/derived_types/StreamLineup.ts';
import type { MediaSourceType } from '../db/schema/base.ts';
import type {
  SpecificMediaSourceType,
  SpecificProgramSourceOrmType,
} from '../db/schema/derivedTypes.ts';
import type { Result } from '../types/result.ts';
import type { ProgramStreamResult } from './types.ts';

export type StreamFetchRequest<Typ extends MediaSourceType = MediaSourceType> =
  {
    server: SpecificMediaSourceType<Typ>;
    lineupItem: SpecificProgramSourceOrmType<Typ, StreamLineupProgram>;
  };

export interface StreamDetailsFetcher<RequestType> {
  getStream(request: RequestType): Promise<Result<ProgramStreamResult>>;
}

export abstract class ExternalStreamDetailsFetcher<
  Typ extends MediaSourceType = MediaSourceType,
> implements StreamDetailsFetcher<StreamFetchRequest<Typ>>
{
  abstract getStream(
    request: StreamFetchRequest<Typ>,
  ): Promise<Result<ProgramStreamResult>>;
}
