import { MediaSourceId } from '@tunarr/shared';
import { isNonEmptyString } from '@tunarr/shared/util';
import { eq } from 'drizzle-orm';
import { inject, injectable } from 'inversify';
import { head, isEmpty } from 'lodash-es';
import { v4 } from 'uuid';
import { KEYS } from '../types/inject.ts';
import { Maybe } from '../types/util.ts';
import { Artwork, NewArtwork } from './schema/Artwork.ts';
import { DrizzleDBAccess } from './schema/index.ts';
import {
  LocalMediaFolder,
  LocalMediaFolderOrm,
  NewLocalMediaFolderOrm,
} from './schema/LocalMediaFolder.ts';
import { MediaSourceLibraryOrm } from './schema/MediaSourceLibrary.ts';
import { ProgramType } from './schema/Program.ts';

@injectable()
export class LocalMediaDB {
  constructor(@inject(KEYS.DrizzleDB) private db: DrizzleDBAccess) {}

  async findFolder(
    library: MediaSourceLibraryOrm,
    parentPath: string,
  ): Promise<Maybe<LocalMediaFolderOrm>> {
    if (isEmpty(parentPath)) {
      return;
    }

    return await this.db.query.localMediaFolder.findFirst({
      where: (fields, { eq, and }) =>
        and(eq(fields.libraryId, library.uuid), eq(fields.path, parentPath)),
    });
  }

  async upsertFolder(
    library: MediaSourceLibraryOrm,
    knownParentId: Maybe<string>,
    folderName: string,
    canonicalId: string,
  ): Promise<UpsertFolderResult> {
    const existingFolder = await this.db.query.localMediaFolder.findFirst({
      where: (fields, { and, eq }) =>
        and(eq(fields.libraryId, library.uuid), eq(fields.path, folderName)),
      with: {
        parent: true,
      },
    });

    if (existingFolder) {
      if (
        isNonEmptyString(knownParentId) &&
        existingFolder.parentId !== knownParentId
      ) {
        await this.db.update(LocalMediaFolder).set({
          parentId: knownParentId,
        });
      }

      return {
        isNew: false,
        folder: existingFolder,
      };
    } else {
      const newFolder: NewLocalMediaFolderOrm = {
        canonicalId,
        libraryId: library.uuid,
        path: folderName,
        uuid: v4(),
        parentId: knownParentId,
      };

      const allInserted = await this.db
        .insert(LocalMediaFolder)
        .values(newFolder)
        .returning();

      const inserted = head(allInserted);
      if (!inserted) {
        throw new Error('Expected exactly one inserted local media folder');
      }

      return {
        isNew: true,
        folder: inserted,
      };
    }
  }

  async setCanonicalId(folderId: string, canonicalId: string) {
    return this.db
      .update(LocalMediaFolder)
      .set({
        canonicalId,
      })
      .where(eq(LocalMediaFolder.uuid, folderId))
      .limit(1);
  }

  async insertArtwork(artwork: NewArtwork): Promise<Maybe<Artwork>> {
    return this.db
      .insert(Artwork)
      .values(artwork)
      .returning()
      .then((_) => head(_));
  }

  async updateArtwork(
    artworkId: string,
    artwork: NewArtwork,
  ): Promise<Maybe<Artwork>> {
    return this.db
      .update(Artwork)
      .set(artwork)
      .where(eq(Artwork.uuid, artworkId))
      .returning()
      .then((_) => head(_));
  }

  async getArtworkForProgram(programId: string) {
    return this.db.query.artwork.findMany({
      where: (fields, { eq }) => eq(fields.programId, programId),
    });
  }

  async findExistingLocalProgram(
    mediaSourceId: MediaSourceId,
    libraryId: string,
    filePath: string,
    programType?: ProgramType,
  ) {
    return this.db.query.program.findFirst({
      where: (fields, { eq, and }) => {
        const clauses = [
          eq(fields.mediaSourceId, mediaSourceId),
          eq(fields.libraryId, libraryId),
          eq(fields.externalKey, filePath),
        ];
        if (programType) {
          clauses.push(eq(fields.type, programType));
        }
        return and(...clauses);
      },
      with: {
        localMediaFolder: true,
        versions: {
          with: {
            chapters: true,
            mediaStreams: true,
          },
        },
        artwork: true,
      },
    });
  }
}

type UpsertFolderResult = {
  isNew: boolean;
  folder: LocalMediaFolderOrm;
};
