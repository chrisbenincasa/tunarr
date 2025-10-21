import type { StreamLineupProgram } from '../db/derived_types/StreamLineup.ts';
import { MediaSourceType } from '../db/schema/base.ts';
import {
  SpecificMediaSourceType,
  SpecificProgramSourceOrmType,
} from '../db/schema/derivedTypes.ts';
import { Result } from '../types/result.ts';
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
