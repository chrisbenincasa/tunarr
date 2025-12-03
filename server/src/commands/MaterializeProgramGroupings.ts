import { MediaSourceId } from '@tunarr/shared';
import { ProgramGrouping, untag } from '@tunarr/types';
import { inject, injectable } from 'inversify';
import { capitalize } from 'lodash-es';
import { NonEmptyArray } from 'ts-essentials';
import { ApiProgramConverters } from '../api/ApiProgramConverters.ts';
import { IProgramDB } from '../db/interfaces/IProgramDB.ts';
import { MediaSourceDB } from '../db/mediaSourceDB.ts';
import { ProgramGroupingOrmWithRelations } from '../db/schema/derivedTypes.ts';
import { KEYS } from '../types/inject.ts';
import { groupByUniq } from '../util/index.ts';
import { Logger } from '../util/logging/LoggerFactory.ts';

@injectable()
export class MaterializeProgramGroupings {
  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(KEYS.ProgramDB) private programDB: IProgramDB,
    @inject(MediaSourceDB) private mediaSourceDB: MediaSourceDB,
  ) {}

  async execute(
    groupings: NonEmptyArray<ProgramGroupingOrmWithRelations>,
  ): Promise<NonEmptyArray<ProgramGrouping>>;
  async execute(
    groupings: ProgramGroupingOrmWithRelations[],
  ): Promise<ProgramGrouping[]>;
  async execute(
    groupings:
      | ProgramGroupingOrmWithRelations[]
      | NonEmptyArray<ProgramGroupingOrmWithRelations>,
  ): Promise<ProgramGrouping[] | NonEmptyArray<ProgramGrouping>> {
    const ids = groupings.map((group) => group.uuid);

    const [mediaSources, groupingCounts] = await Promise.all([
      this.mediaSourceDB
        .getAll()
        .then((_) => groupByUniq(_, (ms) => untag<MediaSourceId>(ms.uuid))),
      this.programDB.getProgramGroupingChildCounts(ids),
    ]);

    const apiGroups: ProgramGrouping[] = [];
    for (const group of groupings) {
      const maybeId = group.mediaSourceId;

      if (!maybeId) {
        this.logger.warn(
          '%s %s missing media_source_id. Try scanning',
          capitalize(group.type),
          group.uuid,
        );
        continue;
      }

      const ms = mediaSources[maybeId];
      if (!ms) {
        this.logger.warn(
          `%s %s has media source ID that doesn't exist in DB`,
          capitalize(group.type),
          group.uuid,
        );
        continue;
      }

      const library = ms.libraries.find((lib) => lib.uuid === group.libraryId);

      if (!library) {
        if (!group.libraryId) {
          this.logger.warn(
            '%s %s does not have a library_id',
            capitalize(group.type),
            group.uuid,
          );
        } else {
          this.logger.warn(
            `%s %s has a library_id that is not associated with it's media source id (ID = %s)`,
            capitalize(group.type),
            group.uuid,
            ms.uuid,
          );
        }
        continue;
      }

      const counts = groupingCounts[group.uuid];
      const apiItem = ApiProgramConverters.convertProgramGrouping(
        group,
        undefined,
        counts,
        ms,
        library,
      );
      if (!apiItem) {
        this.logger.warn(
          'Unable to convert %s %s to API representation',
          capitalize(group.type),
          group.uuid,
        );
        continue;
      }
      apiGroups.push(apiItem);
    }

    return apiGroups;
  }
}
