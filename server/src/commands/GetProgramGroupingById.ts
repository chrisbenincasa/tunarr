import { ProgramGrouping } from '@tunarr/types';
import { inject, injectable } from 'inversify';
import { DrizzleDBAccess } from '../db/schema/index.ts';

import { head } from 'lodash-es';
import { match } from 'ts-pattern';
import { ProgramGroupingType } from '../db/schema/ProgramGrouping.ts';
import { KEYS } from '../types/inject.ts';
import { Maybe } from '../types/util.ts';
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
      },
    });

    if (!dbRes) {
      return;
    }

    const result = head(
      await this.materializeProgramGroupings.execute([dbRes]),
    );

    if (recursive) {
      await match(result)
        .with({ type: 'show' }, async (show) => {
          const seasons = await this.getProgramGroupingChildren.execute(
            show.uuid,
            ProgramGroupingType.Show,
          );
          show.seasons = seasons;
        })
        .with({ type: 'artist' }, async (artist) => {
          const albums = await this.getProgramGroupingChildren.execute(
            artist.uuid,
            ProgramGroupingType.Artist,
          );
          artist.albums = albums;
        })
        .with({ type: 'season' }, async (season) => {
          const [maybeShow, episodes] = await Promise.all([
            dbRes.showUuid
              ? this.execute(dbRes.showUuid, false, depth + 1)
              : Promise.resolve(undefined),
            this.getProgramGroupingChildren.execute(
              season.uuid,
              ProgramGroupingType.Season,
            ),
          ]);

          if (maybeShow?.type === ProgramGroupingType.Show) {
            season.show = maybeShow;
          }

          season.episodes = episodes;
        })
        .with({ type: 'album' }, async (album) => {
          const [maybeArtist, tracks] = await Promise.all([
            dbRes.artistUuid
              ? this.execute(dbRes.artistUuid, false, depth + 1)
              : Promise.resolve(),
            this.getProgramGroupingChildren.execute(
              album.uuid,
              ProgramGroupingType.Album,
            ),
          ]);
          if (maybeArtist?.type === 'artist') {
            album.artist = maybeArtist;
          }
          album.tracks = tracks;
        })
        .otherwise(() => Promise.resolve(void 0));
    }

    return result;
  }
}
