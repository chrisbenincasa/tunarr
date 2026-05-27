import type { MediaArtwork } from '@tunarr/types';
import dayjs from 'dayjs';
import { injectable } from 'inversify';
import { v4 } from 'uuid';
import type { MediaSourceExtra } from '../../types/Media.ts';
import type { NewArtwork } from '../schema/Artwork.ts';
import type { MediaSourceOrm } from '../schema/MediaSource.ts';
import type { MediaSourceLibrary } from '../schema/MediaSourceLibrary.ts';
import type { NewProgramExtra } from '../schema/ProgramExtra.ts';
import type { NewProgramExtraWithRelations } from '../schema/derivedTypes.ts';

@injectable()
export class ProgramExtraMinter {
  mintExtra(
    mediaSource: MediaSourceOrm,
    library: MediaSourceLibrary,
    extra: MediaSourceExtra,
    parentProgramUuid: string | null,
    parentGroupingUuid: string | null,
    now: number = +dayjs(),
  ): NewProgramExtraWithRelations {
    const uuid = v4();

    const newExtra: NewProgramExtra = {
      uuid,
      parentProgramUuid,
      parentGroupingUuid,
      extraType: extra.extraType,
      title: extra.title,
      summary: extra.summary ?? null,
      duration: extra.duration,
      externalKey: extra.externalId,
      sourceType: extra.sourceType,
      mediaSourceId: mediaSource.uuid,
      libraryId: library.uuid,
      filePath: extra.filePath ?? null,
      canonicalId: extra.canonicalId ?? null,
      state: 'ok',
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };

    return {
      extra: newExtra,
      artwork: extra.artwork.map((art) => this.mintArtwork(art, uuid, now)),
    };
  }

  private mintArtwork(
    artwork: MediaArtwork,
    programExtraId: string,
    now: number,
  ): NewArtwork {
    return {
      uuid: v4(),
      programExtraId,
      artworkType: artwork.type,
      createdAt: new Date(now),
      updatedAt: new Date(now),
      sourcePath: artwork.path!,
    };
  }
}
