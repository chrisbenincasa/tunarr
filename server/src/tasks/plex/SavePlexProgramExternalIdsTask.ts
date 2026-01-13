import { ProgramExternalIdType } from '@/db/custom_types/ProgramExternalIdType.js';
import type {
  MinimalProgramExternalId,
  ProgramExternalId,
} from '@/db/schema/ProgramExternalId.js';
import { MediaSourceApiFactory } from '@/external/MediaSourceApiFactory.js';
import type { PlexApiClient } from '@/external/plex/PlexApiClient.js';
import { Task2 } from '@/tasks/Task.js';
import type { Maybe } from '@/types/util.js';
import { mintExternalIdForPlexGuid } from '@/util/externalIds.js';
import { isDefined, isNonEmptyString } from '@/util/index.js';
import { seq } from '@tunarr/shared/util';
import type { PlexTerminalMedia } from '@tunarr/types/plex';
import { inject, injectable } from 'inversify';
import { isEmpty, isNil, isUndefined } from 'lodash-es';
import type { Dictionary } from 'ts-essentials';
import z from 'zod';
import type { IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import { KEYS } from '../../types/inject.ts';

export type SavePlexProgramExternalIdsTaskFactory = (
  programId: string,
) => SavePlexProgramExternalIdsTask;

const SavePlexProgramExternalIdsTaskRequest = z.object({
  programId: z.string(),
});

type SavePlexProgramExternalIdsTaskRequest = z.infer<
  typeof SavePlexProgramExternalIdsTaskRequest
>;

@injectable()
export class SavePlexProgramExternalIdsTask extends Task2<
  typeof SavePlexProgramExternalIdsTaskRequest,
  Maybe<Dictionary<ProgramExternalId[]>>
> {
  static KEY = Symbol.for(SavePlexProgramExternalIdsTask.name);
  ID = SavePlexProgramExternalIdsTask.name;
  schema = SavePlexProgramExternalIdsTaskRequest;

  constructor(
    @inject(KEYS.ProgramDB)
    private programDB: IProgramDB,
    @inject(MediaSourceApiFactory)
    private mediaSourceApiFactory: MediaSourceApiFactory,
  ) {
    super();
  }

  protected async runInternal({
    programId,
  }: SavePlexProgramExternalIdsTaskRequest): Promise<
    Maybe<Dictionary<ProgramExternalId[]>>
  > {
    const program = await this.programDB.getProgramById(programId);

    if (isNil(program)) {
      throw new Error('Program not found ID = ' + programId);
    }

    const plexIds = program.externalIds.filter(
      (eid) =>
        eid.sourceType === ProgramExternalIdType.PLEX.toString() &&
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
