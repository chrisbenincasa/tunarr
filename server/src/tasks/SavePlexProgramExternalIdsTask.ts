import { compact, isEmpty, isError, isNull, isUndefined, map } from 'lodash-es';
import { getEm } from '../dao/dataSource.js';
import { PlexServerSettings } from '../dao/entities/PlexServerSettings.js';
import { Program } from '../dao/entities/Program.js';
import { ProgramExternalId } from '../dao/entities/ProgramExternalId.js';
import { PlexApiFactory, isPlexQueryError } from '../external/plex.js';
import { Maybe } from '../types/util.js';
import { isNonEmptyString } from '../util/index.js';
import { Task } from './Task.js';
import { PlexTerminalMedia } from '@tunarr/types/plex';
import { parsePlexExternalGuid } from '../util/externalIds.js';
import { raw } from '@mikro-orm/core';

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
        eid.sourceType === 'plex' && isNonEmptyString(eid.externalSourceId),
    );

    if (isEmpty(plexIds)) {
      return;
    }

    let server: Maybe<PlexServerSettings> = undefined;
    let chosenId: Maybe<ProgramExternalId> = undefined;
    for (const id of plexIds) {
      const s = await em.findOne(PlexServerSettings, {
        name: id.externalSourceId,
      });
      if (!isNull(s)) {
        server = s;
        chosenId = id;
        break;
      }
    }

    if (isUndefined(server) || isUndefined(chosenId)) {
      return;
    }

    const api = PlexApiFactory.get(server);

    const metadataResult = await api.getItemMetadata(chosenId.externalKey);

    if (isPlexQueryError(metadataResult)) {
      this.logger.error(
        'Error querying Plex for item %s',
        chosenId.externalKey,
      );
      return;
    }

    const metadata = metadataResult.data as PlexTerminalMedia;

    const eids = compact(
      map(metadata.Guid, (guid) => {
        const parsed = parsePlexExternalGuid(guid.id);
        if (!isError(parsed)) {
          parsed.program = program;
          parsed.externalSourceId = undefined;
          return parsed;
        } else {
          this.logger.error(parsed);
        }
        return;
      }),
    );

    const res = await em
      .qb(ProgramExternalId)
      .insert(eids)
      .onConflict(
        raw(
          '(`program_uuid`, `source_type`) where `external_source_id` IS NULL',
        ),
      )
      .merge(['externalKey'])
      .returning(['uuid'])
      .execute();

    console.log(res);

    return;
  }

  get taskName() {
    return SavePlexProgramExternalIdsTask.name;
  }
}
