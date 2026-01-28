import { Show } from '@tunarr/types';
import { inject, injectable } from 'inversify';
import { castArray, head, isString } from 'lodash-es';
import { MaterializeProgramGroupings } from '../../commands/MaterializeProgramGroupings.ts';
import { CustomShowDB } from '../../db/CustomShowDB.ts';
import {
  FillerShowWithContentCount,
  IFillerListDB,
} from '../../db/interfaces/IFillerListDB.ts';
import { IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import { ProgramGroupingOrmWithRelations } from '../../db/schema/derivedTypes.ts';
import { SmartCollectionsDB } from '../../db/SmartCollectionsDB.ts';
import { KEYS } from '../../types/inject.ts';
import { Maybe } from '../../types/util.ts';
import { groupByUniq } from '../../util/index.ts';

type ShowAndRawShow = {
  show: Maybe<Show>;
  raw: ProgramGroupingOrmWithRelations;
};

@injectable()
export class MaterializeSlotHelper {
  constructor(
    @inject(KEYS.ProgramDB) private programDB: IProgramDB,
    @inject(MaterializeProgramGroupings)
    private materializeProgramGroupings: MaterializeProgramGroupings,
    @inject(KEYS.FillerListDB) private fillerDB: IFillerListDB,
    @inject(CustomShowDB) private customShowDB: CustomShowDB,
    @inject(SmartCollectionsDB) private smartCollectionsDB: SmartCollectionsDB,
  ) {}

  async materializeShows(
    showIds: string[],
  ): Promise<Record<string, ShowAndRawShow>> {
    const showsFromDB = await this.programDB.getProgramGroupings(showIds);

    const materialized = groupByUniq(
      await this.materializeProgramGroupings.execute(
        Object.values(showsFromDB),
      ),
      (group) => group.uuid,
    );

    const showsById: Record<string, ShowAndRawShow> = {};
    for (const [id, dbShow] of Object.entries(showsFromDB)) {
      if (dbShow.type !== 'show') {
        continue;
      }
      const materializedShow = materialized[id];
      showsById[id] = {
        show: materializedShow?.type === 'show' ? materializedShow : undefined,
        raw: dbShow,
      };
    }
    return showsById;
  }

  async materializeFiller(
    fillerId: string,
  ): Promise<Maybe<FillerShowWithContentCount>>;
  async materializeFiller(
    fillerIds: string[],
  ): Promise<Record<string, FillerShowWithContentCount>>;
  async materializeFiller(
    fillerIds: string | string[],
  ): Promise<
    | Record<string, FillerShowWithContentCount>
    | Maybe<FillerShowWithContentCount>
  > {
    const filler = await this.fillerDB.getFillerListsByIds(
      castArray(fillerIds),
    );
    if (isString(fillerIds)) {
      return head(filler);
    }
    return groupByUniq(filler, (filler) => filler.uuid);
  }

  async materializeCustomShows(showIds: string[]) {
    const customShows = await this.customShowDB.getShows(showIds);
    return groupByUniq(customShows, (cs) => cs.uuid);
  }

  async materializeSmartCollections(smartCollections: string[]) {
    const collections =
      await this.smartCollectionsDB.getByIds(smartCollections);
    return groupByUniq(collections, (coll) => coll.uuid);
  }
}
