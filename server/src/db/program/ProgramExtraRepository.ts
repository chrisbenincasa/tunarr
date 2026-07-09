import { KEYS } from '@/types/inject.js';
import { sql } from 'drizzle-orm';
import { inject, injectable } from 'inversify';
import { chunk } from 'lodash-es';
import type { NewArtwork } from '../schema/Artwork.ts';
import { ProgramExtra } from '../schema/ProgramExtra.ts';
import type { NewProgramExtraWithRelations } from '../schema/derivedTypes.ts';
import type { DrizzleDBAccess } from '../schema/index.ts';
import { ProgramMetadataRepository } from './ProgramMetadataRepository.ts';
import { isNonEmptyString } from '@/util/index.js';

@injectable()
export class ProgramExtraRepository {
  constructor(
    @inject(KEYS.DrizzleDB) private drizzleDB: DrizzleDBAccess,
    @inject(KEYS.ProgramMetadataRepository)
    private metadataRepo: ProgramMetadataRepository,
  ) {}

  upsertProgramExtras(
    extras: NewProgramExtraWithRelations[],
  ) {
    if (extras.length === 0) {
      return;
    }

    const allArtwork: NewArtwork[] = [];

    for (const batch of chunk(extras, 100)) {
      const upserted = this.drizzleDB
        .insert(ProgramExtra)
        .values(batch.map(({ extra }) => extra))
        .onConflictDoUpdate({
          target: [
            ProgramExtra.sourceType,
            ProgramExtra.mediaSourceId,
            ProgramExtra.externalKey,
          ],
          set: {
            extraType: sql`excluded.extra_type`,
            title: sql`excluded.title`,
            summary: sql`excluded.summary`,
            duration: sql`excluded.duration`,
            filePath: sql`excluded.file_path`,
            canonicalId: sql`excluded.canonical_id`,
            state: sql`excluded.state`,
            updatedAt: sql`excluded.updated_at`,
          },
        })
        .returning({ uuid: ProgramExtra.uuid })
        .all();

      for (let i = 0; i < batch.length; i++) {
        const persistedUuid = upserted[i]?.uuid;
        if (isNonEmptyString(persistedUuid)) {
          const artwork = batch[i]!.artwork.map((art) => ({
            ...art,
            programExtraId: persistedUuid,
          }));
          allArtwork.push(...artwork);
        }
      }
    }

    this.metadataRepo.upsertArtwork(allArtwork);
  }
}
