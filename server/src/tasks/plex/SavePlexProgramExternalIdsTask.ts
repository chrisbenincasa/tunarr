import { ref } from '@mikro-orm/core';
import { PlexTerminalMedia } from '@tunarr/types/plex';
import { compact, isEmpty, isError, isUndefined, map } from 'lodash-es';
import { ProgramExternalIdType } from '../../dao/custom_types/ProgramExternalIdType.js';
import { getEm } from '../../dao/dataSource.js';
import { Program } from '../../dao/entities/Program.js';
import { ProgramExternalId } from '../../dao/entities/ProgramExternalId.js';
import { upsertProgramExternalIds_deprecated } from '../../dao/programExternalIdHelpers.js';
import { isQueryError } from '../../external/BaseApiClient.js';
import { MediaSourceApiFactory } from '../../external/MediaSourceApiFactory.js';
import { PlexApiClient } from '../../external/plex/PlexApiClient.js';
import { Maybe } from '../../types/util.js';
import { mintExternalIdForPlexGuid } from '../../util/externalIds.js';
import { isDefined, isNonEmptyString } from '../../util/index.js';
import { Task } from '../Task.js';

export class SavePlexProgramExternalIdsTask extends Task {
  ID = SavePlexProgramExternalIdsTask.name;

  constructor(private programId: string) {
    super();
  }

  protected async runInternal(): Promise<unknown> {
    const em = getEm();

    const program = await em.findOneOrFail(Program, this.programId);

    const plexIds = program.externalIds.filter(
      (eid) =>
        eid.sourceType === ProgramExternalIdType.PLEX &&
        isNonEmptyString(eid.externalSourceId),
    );

    if (isEmpty(plexIds)) {
      return;
    }

    let chosenId: Maybe<ProgramExternalId> = undefined;
    let api: Maybe<PlexApiClient>;
    for (const id of plexIds) {
      if (!isNonEmptyString(id.externalSourceId)) {
        continue;
      }

      api = await MediaSourceApiFactory().getOrSet(id.externalSourceId);

      if (isDefined(api)) {
        chosenId = id;
        break;
      }
    }

    if (isUndefined(api) || isUndefined(chosenId)) {
      return;
    }

    const metadataResult = await api.getItemMetadata(chosenId.externalKey);

    if (isQueryError(metadataResult)) {
      this.logger.error(
        'Error querying Plex for item %s',
        chosenId.externalKey,
      );
      return;
    }

    const metadata = metadataResult.data as PlexTerminalMedia;

    const eids = compact(
      map(metadata.Guid, (guid) => {
        const parsed = mintExternalIdForPlexGuid(guid.id);
        if (!isError(parsed)) {
          parsed.program = ref(program);
          parsed.externalSourceId = undefined;
          return parsed;
        } else {
          this.logger.error(parsed);
        }
        return;
      }),
    );

    return await upsertProgramExternalIds_deprecated(eids);
  }

  get taskName() {
    return SavePlexProgramExternalIdsTask.name;
  }
}
