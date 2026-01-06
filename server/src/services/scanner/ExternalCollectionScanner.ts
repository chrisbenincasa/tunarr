import type { MediaSourceId } from '@tunarr/shared';
import { BaseMediaSourceScanner } from './MediaSourceScanner.ts';

export type ExternalCollectionScanRequest = {
  mediaSourceId: MediaSourceId;
  force?: boolean;
};

export type ExternalCollectionLibraryScanRequest = {
  libraryId: string;
  force?: boolean;
};

export abstract class ExternalCollectionScanner<
  ApiClientT,
> extends BaseMediaSourceScanner<ApiClientT, ExternalCollectionScanRequest> {
  abstract scanLibrary(
    req: ExternalCollectionLibraryScanRequest,
  ): Promise<void>;
}

export type GenericExternalCollectionScanner =
  ExternalCollectionScanner<unknown>;
