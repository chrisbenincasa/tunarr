import { ProgramGrouping } from '@tunarr/types';
import { inject, injectable } from 'inversify';
import { DrizzleDBAccess } from '../db/schema/index.ts';

import { head } from 'lodash-es';
import { KEYS } from '../types/inject.ts';
import { Maybe } from '../types/util.ts';
import { MaterializeProgramGroupings } from './MaterializeProgramGroupings.ts';

@injectable()
export class GetProgramGroupingById {
  constructor(
    @inject(KEYS.DrizzleDB) private db: DrizzleDBAccess,
    @inject(MaterializeProgramGroupings)
    private materializeProgramGroupings: MaterializeProgramGroupings,
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
    }

    const result = head(
      await this.materializeProgramGroupings.execute([dbRes]),
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
