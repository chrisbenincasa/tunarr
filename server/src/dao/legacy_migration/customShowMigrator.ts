import fs from 'fs/promises';
import ld, { isNil, maxBy, partition } from 'lodash-es';
import path from 'path';
import { groupByUniq, mapAsyncSeq } from '../../util.js';
import { withDb } from '../dataSource.js';
import { CustomShow as CustomShowEntity } from '../entities/CustomShow.js';
import { CustomShowContent } from '../entities/CustomShowContent.js';
import { FillerShow } from '../entities/FillerShow.js';
import { CustomShow, logger } from '../legacyDbMigration.js';
import { persistProgram } from './channelMigrator.js';
import {
  JSONArray,
  JSONObject,
  convertProgram,
  uniqueProgramId,
} from './migrationUtil.js';

export async function convertCustomShow(
  id: string,
  fullPath: string,
  type: 'custom-shows' | 'filler',
) {
  const prettyType = type === 'custom-shows' ? 'custom show' : 'filler';
  logger.info(`Migrating ${prettyType}: ${fullPath}`);
  const channel = await fs.readFile(fullPath);
  const parsed = JSON.parse(channel.toString('utf-8')) as JSONObject;

  const show: CustomShow = {
    id,
    name: parsed['name'] as string,
    content: (parsed['content'] as JSONArray).map(convertProgram),
  };

  return show;
}

export async function migrateCustomShows(
  dbPath: string,
  type: 'custom-shows' | 'filler',
) {
  const customShowsPath = path.join(dbPath, type);
  const configFiles = await fs.readdir(customShowsPath);

  const newCustomShows = await configFiles.reduce(
    async (prev, file) => {
      const id = file.replace('.json', '');
      return [
        ...(await prev),
        await convertCustomShow(id, path.join(customShowsPath, file), type),
      ];
    },
    Promise.resolve([] as CustomShow[]),
  );

  await withDb(async (em) => {
    const uniquePrograms = ld
      .chain(newCustomShows)
      .flatMap((cs) => cs.content)
      .uniqBy(uniqueProgramId)
      .value();

    const persistedPrograms = (
      await mapAsyncSeq(uniquePrograms, (program) =>
        persistProgram(program).then((dbProgram) =>
          dbProgram
            ? {
                [uniqueProgramId(program)]: dbProgram,
              }
            : {},
        ),
      )
    ).reduce((value, prev) => ({ ...value, ...prev }), {});

    const entityType = type === 'custom-shows' ? CustomShowEntity : FillerShow;
    const repo = em.getRepository(entityType);

    const customShowById = groupByUniq(newCustomShows, 'id');

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
        const csContent = ld
          .chain(hasOrder)
          .sortBy((c) => c.customOrder)
          .concat(newOrder)
          .map((c) =>
            em.create(CustomShowContent, {
              index: c.customOrder!,
              customShow: entity.uuid,
              content: persistedPrograms[uniqueProgramId(c)],
            }),
          )
          .value();
        em.persist(csContent);
      } else {
        // Handle filler shows
        entity.content.set(
          content.map((c) => persistedPrograms[uniqueProgramId(c)]),
        );
        em.persist(entity);
      }
    });

    await em.flush();
  });
}
