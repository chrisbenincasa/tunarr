import { ProgramGrouping, tag } from '@tunarr/types';
import { inject, injectable } from 'inversify';
import { ApiProgramConverters } from '../api/ApiProgramConverters.ts';
import { MediaSourceDB } from '../db/mediaSourceDB.ts';
import { ProgramDB } from '../db/ProgramDB.ts';
import { DrizzleDBAccess } from '../db/schema/index.ts';
import {
  decodeCaseSensitiveId,
  MeilisearchService,
} from '../services/MeilisearchService.ts';
import { KEYS } from '../types/inject.ts';
import { Maybe } from '../types/util.ts';
import { isProgramGroupingDocument } from '../util/search.ts';

@injectable()
export class GetProgramGroupingById {
  constructor(
    @inject(KEYS.DrizzleDB) private db: DrizzleDBAccess,
    @inject(KEYS.ProgramDB) private programDB: ProgramDB,
    @inject(MeilisearchService) private searchService: MeilisearchService,
    @inject(MediaSourceDB) private mediaSourceDB: MediaSourceDB,
  ) {}

  async execute(
    id: string,
    recursive: boolean = false,
    depth: number = 1,
  ): Promise<Maybe<ProgramGrouping>> {
    if (depth > 2) {
      return;
    }

    const dbRes = await this.db.query.programGrouping.findFirst({
      where: (program, { eq }) => eq(program.uuid, id),
      with: {
        show: true,
        artist: true,
        externalIds: true,
        artwork: true,
        credits: {
          with: {
            artwork: true,
          },
        },
      },
    });

    if (!dbRes) {
      return;
      // return res.status(404).send();
    }

    const groupingCounts = await this.programDB.getProgramGroupingChildCounts([
      dbRes.uuid,
    ]);

    const searchDoc = await this.searchService.getProgram(dbRes.uuid);
    if (!searchDoc || !isProgramGroupingDocument(searchDoc)) {
      // return res.status(404).send();
      return;
    }

    const mediaSourceId = decodeCaseSensitiveId(searchDoc.mediaSourceId);
    const mediaSource = await this.mediaSourceDB.getById(tag(mediaSourceId));
    if (!mediaSource) {
      return;
    }
    const libraryId = decodeCaseSensitiveId(searchDoc.libraryId);
    const library = await this.mediaSourceDB.getLibrary(libraryId);
    if (!library) {
      return;
    }

    if (!dbRes.canonicalId) {
      return;
    }

    const result = ApiProgramConverters.convertProgramGroupingSearchResult(
      searchDoc,
      dbRes,
      groupingCounts[dbRes.uuid],
      mediaSource,
      library,
    );

    if (recursive) {
      if (result.type === 'season' && dbRes.showUuid) {
        const maybeShow = await this.execute(dbRes.showUuid, false, depth + 1);
        if (maybeShow?.type === 'show') {
          result.show = maybeShow;
        }
      } else if (result.type === 'album' && dbRes.artistUuid) {
        const maybeArtist = await this.execute(
          dbRes.artistUuid,
          false,
          depth + 1,
        );
        if (maybeArtist?.type === 'artist') {
          result.artist = maybeArtist;
        }
      }
    }

    return result;
  }
}
