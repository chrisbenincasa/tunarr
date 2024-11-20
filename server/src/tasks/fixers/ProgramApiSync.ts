import { ProgramDB } from '@/db/ProgramDB.ts';
import { isNonEmptyString } from '@/util/index.ts';
import { groupBy, mapValues, partition } from 'lodash-es';

export class ProgramApiSync {
  constructor(private programDB = new ProgramDB()) {}

  async createSyncTasks() {
    const missingAssociations =
      await this.programDB.getMissingAssociations(false);

    const missingByTypeAndSource = mapValues(
      groupBy(missingAssociations, (assoc) => assoc.type),
      (assocs) => groupBy(assocs, (assoc) => assoc.sourceType),
    );

    for (const [programType, missingBySource] of Object.entries(
      missingByTypeAndSource,
    )) {
      for (const [sourceType, associations] of Object.entries(
        missingBySource,
      )) {
        const [hasGrandparent, noGrandparet] = partition(
          associations,
          (assoc) => isNonEmptyString(assoc.grandparentExternalKey),
        );
        const byGrandparentKey = groupBy(
          hasGrandparent,
          (assoc) => assoc.grandparentExternalKey,
        );
      }
    }
  }
}
