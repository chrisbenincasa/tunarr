import { seq } from '@tunarr/shared/util';
import fs from 'fs/promises';
import {
  concat,
  filter,
  flatMap,
  isNil,
  map,
  maxBy,
  partition,
  reduce,
  sortBy,
  uniqBy,
} from 'lodash-es';
import path from 'path';
import {
  groupByUniqProp,
  isNonEmptyString,
  mapAsyncSeq,
} from '../../util/index.js';
import { LoggerFactory } from '../../util/logging/LoggerFactory.js';
import { getEm } from '../dataSource.js';
import { CustomShow as CustomShowEntity } from '../entities/CustomShow.js';
import { CustomShowContent } from '../entities/CustomShowContent.js';
import { FillerListContent } from '../entities/FillerListContent.js';
import { FillerShow, FillerShowId } from '../entities/FillerShow.js';
import { Program } from '../entities/Program.js';
import { CustomShow } from './legacyDbMigration.js';
import {
  JSONArray,
  JSONObject,
  convertRawProgram,
  createProgramEntity,
  uniqueProgramId,
} from './migrationUtil.js';

// Migrates flex and custom shows
export class LegacyLibraryMigrator {
  private logger = LoggerFactory.child({
    caller: import.meta,
    className: this.constructor.name,
  });

  async convertCustomShow(
    id: string,
    fullPath: string,
    type: 'custom-shows' | 'filler',
  ) {
    const prettyType = type === 'custom-shows' ? 'custom show' : 'filler';
    this.logger.debug(`Migrating ${prettyType}: ${fullPath}`);
    const channel = await fs.readFile(fullPath);
    const parsed = JSON.parse(channel.toString('utf-8')) as JSONObject;

    const show: CustomShow = {
      id,
      name: parsed['name'] as string,
      content: (parsed['content'] as JSONArray).map(convertRawProgram),
    };

    return show;
  }

  async migrateCustomShows(dbPath: string, type: 'custom-shows' | 'filler') {
    const customShowsPath = path.join(dbPath, type);
    const configFiles = await fs.readdir(customShowsPath);

    const newCustomShows = await configFiles.reduce(
      async (prev, file) => {
        if (!file.endsWith('.json')) {
          return [...(await prev)];
        }

        const id = file.replace('.json', '');
        return [
          ...(await prev),
          await this.convertCustomShow(
            id,
            path.join(customShowsPath, file),
            type,
          ),
        ];
      },
      Promise.resolve([] as CustomShow[]),
    );

    const em = getEm();

    const uniquePrograms = uniqBy(
      filter(
        flatMap(newCustomShows, (cs) => cs.content),
        (p) =>
          isNonEmptyString(p.serverKey) &&
          isNonEmptyString(p.ratingKey) &&
          isNonEmptyString(p.key),
      ),
      uniqueProgramId,
    );

    const programEntities = seq.collect(uniquePrograms, createProgramEntity);

    this.logger.debug(
      'Upserting %d programs from legacy DB',
      programEntities.length,
    );

    const persistedPrograms = reduce(
      await em.upsertMany(Program, programEntities, {
        batchSize: 25,
        onConflictFields: ['sourceType', 'externalSourceId', 'externalKey'],
        onConflictAction: 'merge',
        onConflictExcludeFields: ['uuid'],
      }),
      (prev, curr) => ({
        ...prev,
        [`${curr.externalSourceId}|${curr.externalKey}`]: curr,
      }),
      {} as Record<string, Program>,
    );

    // const persistedPrograms = (
    //   await mapAsyncSeq(uniquePrograms, (program) =>
    //     persistProgram(program).then((dbProgram) =>
    //       dbProgram
    //         ? {
    //             [uniqueProgramId(program)]: dbProgram,
    //           }
    //         : {},
    //     ),
    //   )
    // ).reduce((value, prev) => ({ ...value, ...prev }), {});

    const entityType = type === 'custom-shows' ? CustomShowEntity : FillerShow;
    const repo = em.getRepository(entityType);

    const customShowById = groupByUniqProp(newCustomShows, 'id');

    await mapAsyncSeq(newCustomShows, async (customShow) => {
      // Refresh the entity after inserting programs
      const existing = await repo.findOne(
        { uuid: customShow.id },
        { populate: ['content'], refresh: true },
      );

      // If we didn't find one, initialize it
      const entity =
        existing ??
        em.create(entityType, {
          uuid: customShow.id,
          name: customShow.name,
        });

      // Reset mappings
      const content = customShowById[entity.uuid].content;
      entity.content.removeAll();
      await em.flush();

      if (type === 'custom-shows') {
        const [hasOrder, noOrder] = partition(
          content,
          (c) => !isNil(c.customOrder),
        );
        const maxOrder =
          maxBy(hasOrder, (c) => c.customOrder)?.customOrder ?? 0;
        const newOrder = noOrder.map((c, idx) => ({
          ...c,
          customOrder: maxOrder + idx + 1,
        }));
        const csContent = map(
          concat(
            sortBy(hasOrder, (c) => c.customOrder),
            newOrder,
          ),
          (c) =>
            em.create(CustomShowContent, {
              index: c.customOrder!,
              customShow: entity.uuid,
              content: persistedPrograms[uniqueProgramId(c)],
            }),
        );

        await em.upsertMany(CustomShowContent, csContent, { batchSize: 25 });
      } else {
        // Handle filler shows
        // These are selected randomly by the scheduler so we'll just zip them with
        // their index here.
        const programs = seq.collect(
          content,
          (c) => persistedPrograms[uniqueProgramId(c)],
        );
        const entities = map(programs, (program, index) =>
          em.create(FillerListContent, {
            index,
            content: em.getReference(Program, program.uuid),
            fillerList: em.getReference(
              FillerShow,
              entity.uuid as FillerShowId,
            ),
          }),
        );

        await em.upsertMany(FillerListContent, entities, { batchSize: 25 });
      }

      await em.flush();
    });
  }
}
