import type { ProgramGrouping } from '@tunarr/types';
import { inject, injectable } from 'inversify';
import type { DrizzleDBAccess } from '../db/schema/index.ts';

import { head } from 'lodash-es';
import { ProgramGroupingType } from '../db/schema/ProgramGrouping.ts';
import { KEYS } from '../types/inject.ts';
import type { Maybe } from '../types/util.ts';
import { GetProgramGroupingChildren } from './GetProgramGroupingChildren.ts';
import { MaterializeProgramGroupings } from './MaterializeProgramGroupings.ts';

@injectable()
export class GetProgramGroupingById {
  constructor(
    @inject(KEYS.DrizzleDB) private db: DrizzleDBAccess,
    @inject(MaterializeProgramGroupings)
    private materializeProgramGroupings: MaterializeProgramGroupings,
    @inject(GetProgramGroupingChildren)
    private getProgramGroupingChildren: GetProgramGroupingChildren,
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
        genres: {
          with: {
            genre: true,
          },
        },
        studios: {
          with: {
            studio: true,
          },
        },
        tags: {
          with: {
            tag: true,
          },
        },
      },
    });

    if (!dbRes) {
      return;
    }

    const result = head(
      await this.materializeProgramGroupings.execute([dbRes]),
    );

    if (recursive && result) {
      switch (result.type) {
        case 'show': {
          const seasons = await this.getProgramGroupingChildren.execute(
            result.uuid,
            ProgramGroupingType.Show,
          );
          result.seasons = seasons;
          break;
        }
        case 'artist': {
          const albums = await this.getProgramGroupingChildren.execute(
            result.uuid,
            ProgramGroupingType.Artist,
          );
          result.albums = albums;
          break;
        }
        case 'season': {
          const [maybeShow, episodes] = await Promise.all([
            dbRes.showUuid
              ? this.execute(dbRes.showUuid, false, depth + 1)
              : Promise.resolve(undefined),
            this.getProgramGroupingChildren.execute(
              result.uuid,
              ProgramGroupingType.Season,
            ),
          ]);

          if (maybeShow?.type === ProgramGroupingType.Show) {
            result.show = maybeShow;
          }

          result.episodes = episodes;
          break;
        }
        case 'album': {
          const [maybeArtist, tracks] = await Promise.all([
            dbRes.artistUuid
              ? this.execute(dbRes.artistUuid, false, depth + 1)
              : Promise.resolve(),
            this.getProgramGroupingChildren.execute(
              result.uuid,
              ProgramGroupingType.Album,
            ),
          ]);
          if (maybeArtist?.type === 'artist') {
            result.artist = maybeArtist;
          }
          result.tracks = tracks;
          break;
        }
      }
    }

    return result;
  }
}
