import dayjs from 'dayjs';
import { compact, isEmpty, isUndefined, map } from 'lodash-es';
import { v4 } from 'uuid';
import { ProgramDB } from '../../db/ProgramDB.ts';
import {
  ProgramExternalIdType,
  programExternalIdTypeFromJellyfinProvider,
} from '../../db/custom_types/ProgramExternalIdType.ts';
import { upsertRawProgramExternalIds } from '../../db/programExternalIdHelpers.ts';
import {
  NewProgramExternalId,
  ProgramExternalId,
} from '../../db/schema/ProgramExternalId.ts';
import { isQueryError } from '../../external/BaseApiClient.js';
import { MediaSourceApiFactory } from '../../external/MediaSourceApiFactory.js';
import { JellyfinApiClient } from '../../external/jellyfin/JellyfinApiClient.js';
import { Maybe } from '../../types/util.js';
import { isDefined, isNonEmptyString } from '../../util/index.js';
import { Task } from '../Task.js';

export class SaveJellyfinProgramExternalIdsTask extends Task {
  ID = SaveJellyfinProgramExternalIdsTask.name;

  constructor(
    private programId: string,
    private programDB: ProgramDB = new ProgramDB(),
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

    let chosenId: Maybe<ProgramExternalId> = undefined;
    let api: Maybe<JellyfinApiClient>;
    for (const id of jellyfinIds) {
      if (!isNonEmptyString(id.externalSourceId)) {
        continue;
      }

      api = await MediaSourceApiFactory().getJellyfinByName(
        id.externalSourceId,
      );

      if (isDefined(api)) {
        chosenId = id;
        break;
      }
    }

    if (isUndefined(api) || isUndefined(chosenId)) {
      return;
    }

    const metadataResult = await api.getItem(chosenId.externalKey);

    if (isQueryError(metadataResult)) {
      this.logger.error(
        'Error querying Jellyfin for item %s',
        chosenId.externalKey,
      );
      return;
    }

    const metadata = metadataResult.data;

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
          uuid: v4(),
          createdAt: +dayjs(),
          updatedAt: +dayjs(),
          externalKey: id,
          sourceType: type,
          programUuid: program.uuid,
        } satisfies NewProgramExternalId;
      }),
    );

    return await upsertRawProgramExternalIds(eids);
  }

  get taskName() {
    return SaveJellyfinProgramExternalIdsTask.name;
  }
}
