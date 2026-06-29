import { inject, injectable } from 'inversify';
import { intersection, uniq } from 'lodash-es';
import { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import type { MediaSourceId } from '../../db/schema/base.ts';
import { MediaSourceApiFactory } from '../../external/MediaSourceApiFactory.ts';
import { PlexHostLookup } from '../../external/plex/PlexHostLookup.ts';
import { TypedError } from '../../types/errors.ts';
import { Result } from '../../types/result.ts';
import type { Maybe } from '../../types/util.ts';
import { InjectLogger } from '../../util/inject.ts';
import type { Logger } from '../../util/logging/LoggerFactory.ts';
import type { Command } from '../Command.ts';

type BackfillPlexClientIdentifierRequest = {
  mediaSourceId: MediaSourceId;
};

@injectable()
export class BackfillPlexClientIdentifierCommand
  implements Command<BackfillPlexClientIdentifierRequest, Result<Maybe<string>>>
{
  @InjectLogger() declare private readonly logger: Logger;

  constructor(
    @inject(MediaSourceApiFactory)
    private mediaSourceApiFactory: MediaSourceApiFactory,
    @inject(MediaSourceDB) private mediaSourceDB: MediaSourceDB,
    @inject(PlexHostLookup) private plexHostLookup: PlexHostLookup,
  ) {}

  async run(
    request: BackfillPlexClientIdentifierRequest,
  ): Promise<Result<Maybe<string>>> {
    try {
      const mediaSource = await this.mediaSourceDB.findByType(
        'plex',
        request.mediaSourceId,
      );
      if (!mediaSource) {
        return Result.failure(
          `No media source for ID ${request.mediaSourceId}`,
        );
      }

      const client =
        await this.mediaSourceApiFactory.getPlexApiClientForMediaSource(
          mediaSource,
        );

      const dnsResolution = await this.plexHostLookup.lookup(mediaSource.uri);

      if (dnsResolution.isFailure()) {
        return dnsResolution.recast();
      }

      const resourcesResult = await client.getResources();

      if (resourcesResult.isFailure()) {
        return resourcesResult.recast();
      }

      const resources = resourcesResult.get();

      for (const resource of resources) {
        if (!resource.provides.includes('server')) continue;
        const allUris = uniq(resource.connections.map((conn) => conn.uri));
        const lookupResults = await Promise.allSettled(
          allUris.map((uri) => this.plexHostLookup.lookup(uri)),
        );
        for (const lookupResult of lookupResults) {
          if (lookupResult.status === 'rejected') {
            // TODO: log
            this.logger.warn(lookupResult.reason);
            continue;
          } else if (lookupResult.value.isFailure()) {
            this.logger.warn(lookupResult.value.error);
            continue;
          }

          if (
            intersection(lookupResult.value.get(), dnsResolution.get()).length >
            0
          ) {
            await this.mediaSourceDB.setClientIdentifier(
              request.mediaSourceId,
              resource.clientIdentifier,
            );
            return Result.success(resource.clientIdentifier);
          }
        }
      }
      return Result.success(undefined);
    } catch (e) {
      return Result.forError(TypedError.fromAny(e));
    }
  }
}
