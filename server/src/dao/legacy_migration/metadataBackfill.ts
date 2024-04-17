// This should be run after all regular entities have been migrated

import { ProgramSourceType } from '../custom_types/ProgramSourceType';
import { getEm } from '../dataSource';
import { PlexServerSettings } from '../entities/PlexServerSettings';
import { Program, ProgramType } from '../entities/Program';

// It requires valid PlexServerSettings, program metadata, etc
export async function backfillParentMetadata() {
  const em = getEm();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const allServers = em.findAll(PlexServerSettings);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const missingGrandparents = await em
    .createQueryBuilder(Program)
    .select(['externalSourceId', 'externalKey'], true)
    .where({
      type: ProgramType.Episode,
      $or: [
        {
          grandparentExternalKey: null, // This will probably be all items
          tvShow: null,
        },
        {
          parentExternalKey: null, // This will probably be all items
          season: null,
        },
      ],

      // At the time this was written, this was the only source type
      sourceType: ProgramSourceType.PLEX,
    })
    .execute();
}
