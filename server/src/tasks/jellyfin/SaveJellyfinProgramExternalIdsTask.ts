import type { IProgramDB } from '@/db/interfaces/IProgramDB.js';
import { type MediaSourceApiFactory } from '@/external/MediaSourceApiFactory.js';
import type { JellyfinApiClient } from '@/external/jellyfin/JellyfinApiClient.js';
import { Task } from '@/tasks/Task.js';
import type { Maybe } from '@/types/util.js';
import { isDefined, isNonEmptyString } from '@/util/index.js';
import dayjs from 'dayjs';
import { compact, isEmpty, isUndefined, map } from 'lodash-es';
import { v4 } from 'uuid';
import {
  ProgramExternalIdType,
  programExternalIdTypeFromJellyfinProvider,
} from '../../db/custom_types/ProgramExternalIdType.ts';
import type {
  MinimalProgramExternalId,
  NewSingleOrMultiExternalId,
} from '../../db/schema/ProgramExternalId.ts';

export type SaveJellyfinProgramExternalIdsTaskFactory = (
  programId: string,
) => SaveJellyfinProgramExternalIdsTask;

export class SaveJellyfinProgramExternalIdsTask extends Task {
  static KEY = Symbol.for(SaveJellyfinProgramExternalIdsTask.name);
  ID = SaveJellyfinProgramExternalIdsTask.name;

  constructor(
    private programId: string,
    private programDB: IProgramDB,
    private mediaSourceApiFactory: MediaSourceApiFactory,
  ) {
    super();
  }

  protected async runInternal(): Promise<unknown> {
    const program = await this.programDB.getProgramById(this.programId);

    if (!program) {
      throw new Error('Program not found: ID = ' + this.programId);
    }

    const jellyfinIds = program.externalIds.filter(
      (eid) =>
        eid.sourceType === ProgramExternalIdType.JELLYFIN &&
        isNonEmptyString(eid.externalSourceId),
    );

    if (isEmpty(jellyfinIds)) {
      return;
    }

    let chosenId: Maybe<MinimalProgramExternalId> = undefined;
    let api: Maybe<JellyfinApiClient>;
    for (const id of jellyfinIds) {
      if (!isNonEmptyString(id.mediaSourceId)) {
        continue;
      }

      api = await this.mediaSourceApiFactory.getJellyfinApiClientById(
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

    const metadataResult = await api.getRawItem(chosenId.externalKey);

    if (metadataResult.isFailure()) {
      this.logger.error(
        'Error querying Jellyfin for item %s',
        chosenId.externalKey,
      );
      return;
    }

    const metadata = metadataResult.get();

    const eids = compact(
      map(metadata?.ProviderIds, (id, provider) => {
        if (!isNonEmptyString(id)) {
          return;
        }

        const type = programExternalIdTypeFromJellyfinProvider(provider);
        if (!type) {
          return;
        }

        return {
          type: 'single',
          uuid: v4(),
          createdAt: +dayjs(),
          updatedAt: +dayjs(),
          externalKey: id,
          sourceType: type,
          programUuid: program.uuid,
        } satisfies NewSingleOrMultiExternalId;
      }),
    );

    return await this.programDB.upsertProgramExternalIds(eids);
  }

  get taskName() {
    return SaveJellyfinProgramExternalIdsTask.name;
  }
}
