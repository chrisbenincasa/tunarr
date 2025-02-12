import { ProgramExternalIdType } from '@/db/custom_types/ProgramExternalIdType.js';
import type { MinimalProgramExternalId } from '@/db/schema/ProgramExternalId.js';
import { type MediaSourceApiFactory } from '@/external/MediaSourceApiFactory.js';
import type { PlexApiClient } from '@/external/plex/PlexApiClient.js';
import { Task } from '@/tasks/Task.js';
import type { Maybe } from '@/types/util.js';
import { mintExternalIdForPlexGuid } from '@/util/externalIds.js';
import { isDefined, isNonEmptyString } from '@/util/index.js';
import { seq } from '@tunarr/shared/util';
import type { PlexTerminalMedia } from '@tunarr/types/plex';
import { isEmpty, isNil, isUndefined } from 'lodash-es';
import type { IProgramDB } from '../../db/interfaces/IProgramDB.ts';

export type SavePlexProgramExternalIdsTaskFactory = (
  programId: string,
) => SavePlexProgramExternalIdsTask;

export class SavePlexProgramExternalIdsTask extends Task {
  static KEY = Symbol.for(SavePlexProgramExternalIdsTask.name);
  ID = SavePlexProgramExternalIdsTask.name;

  constructor(
    private programId: string,
    private programDB: IProgramDB,
    private mediaSourceApiFactory: MediaSourceApiFactory,
  ) {
    super();
  }

  protected async runInternal(): Promise<unknown> {
    const program = await this.programDB.getProgramById(this.programId);

    if (isNil(program)) {
      throw new Error('Program not found ID = ' + this.programId);
    }

    const plexIds = program.externalIds.filter(
      (eid) =>
        eid.sourceType === ProgramExternalIdType.PLEX &&
        isNonEmptyString(eid.externalSourceId),
    );

    if (isEmpty(plexIds)) {
      return;
    }

    let chosenId: Maybe<MinimalProgramExternalId> = undefined;
    let api: Maybe<PlexApiClient>;
    for (const id of plexIds) {
      if (!isNonEmptyString(id.mediaSourceId)) {
        continue;
      }

      api = await this.mediaSourceApiFactory.getPlexApiClientById(
        id.mediaSourceId,
      );

      if (isDefined(api)) {
        chosenId = id;
        break;
      }
    }

    if (isUndefined(api) || isUndefined(chosenId)) {
      return;
    }

    const metadataResult = await api.getItemMetadata(chosenId.externalKey);

    if (metadataResult.isFailure()) {
      this.logger.error(
        metadataResult.error,
        'Error querying Plex for item %s',
        chosenId.externalKey,
      );
      return;
    }

    const metadata = metadataResult.get() as PlexTerminalMedia;

    const eids = seq.collect(metadata.Guid, (guid) =>
      mintExternalIdForPlexGuid(guid.id, program.uuid),
    );

    return await this.programDB.upsertProgramExternalIds(eids);
  }

  get taskName() {
    return SavePlexProgramExternalIdsTask.name;
  }
}
