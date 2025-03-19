import type { NewCustomShowContent } from '@/db/schema/CustomShow.js';
import type { NewFillerShowContent } from '@/db/schema/FillerShow.js';
import { Logger } from '@/util/logging/LoggerFactory.js';
import { seq } from '@tunarr/shared/util';
import dayjs from 'dayjs';
import { inject, injectable } from 'inversify';
import { Kysely } from 'kysely';
import {
  chunk,
  compact,
  concat,
  filter,
  flatMap,
  isNil,
  map,
  maxBy,
  partition,
  sortBy,
  uniqBy,
} from 'lodash-es';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  ProgramUpsertFields,
  withCustomShowPrograms,
  withFillerPrograms,
} from '../../db/programQueryHelpers.ts';
import { DB } from '../../db/schema/db.ts';
import { KEYS } from '../../types/inject.ts';
import {
  groupByUniq,
  groupByUniqAndMap,
  groupByUniqProp,
  isNonEmptyString,
  mapAsyncSeq,
  mapToObj,
} from '../../util/index.ts';
import type { LegacyProgram } from './LegacyChannelMigrator.ts';
import type { CustomShow } from './legacyDbMigration.ts';
import type { JSONArray, JSONObject } from './migrationUtil.ts';
import {
  convertRawProgram,
  createProgramEntity,
  uniqueProgramId,
} from './migrationUtil.ts';

// Migrates flex and custom shows
@injectable()
export class LegacyLibraryMigrator {
  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(KEYS.Database) private db: Kysely<DB>,
  ) {}

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

    const uniquePrograms = uniqBy<LegacyProgram>(
      filter(
        flatMap(newCustomShows, (cs) => cs.content),
        (p) =>
          isNonEmptyString(p.serverKey) &&
          isNonEmptyString(p.ratingKey) &&
          isNonEmptyString(p.key),
      ),
      uniqueProgramId,
    );

    const mediaSourcesByName = await this.db
      .selectFrom('mediaSource')
      .selectAll()
      .execute()
      .then((_) => groupByUniqAndMap(_, 'name', (ms) => ms.uuid));

    const programEntities = seq.collect(uniquePrograms, (program) =>
      createProgramEntity(program, mediaSourcesByName),
    );

    this.logger.debug(
      'Upserting %d programs from legacy DB',
      programEntities.length,
    );

    const upsertedPrograms: {
      uuid: string;
      externalSourceId: string;
      externalKey: string;
    }[] = [];
    for (const c of chunk(programEntities, 100)) {
      upsertedPrograms.push(
        ...(await this.db.transaction().execute((tx) =>
          tx
            .insertInto('program')
            .values(map(c, 'program'))
            .onConflict((oc) =>
              oc
                .columns(['sourceType', 'externalSourceId', 'externalKey'])
                .doUpdateSet((eb) =>
                  mapToObj(ProgramUpsertFields, (f) => ({
                    [f.replace('excluded.', '')]: eb.ref(f),
                  })),
                ),
            )
            .returning([
              'uuid as uuid',
              'externalSourceId as externalSourceId',
              'externalKey as externalKey',
            ])
            .execute(),
        )),
      );
    }

    const persistedPrograms: Record<
      string,
      {
        uuid: string;
        externalSourceId: string;
        externalKey: string;
      }
    > = groupByUniq(
      upsertedPrograms,
      (curr) => `${curr.externalSourceId}|${curr.externalKey}`,
    );

    const customShowById = groupByUniqProp(newCustomShows, 'id');

    await mapAsyncSeq(newCustomShows, async (customShow) => {
      if (type === 'custom-shows') {
        const existing = await this.db
          .selectFrom('customShow')
          .selectAll()
          .where('customShow.uuid', '=', customShow.id)
          .select(withCustomShowPrograms)
          .executeTakeFirst();

        const entity =
          existing ??
          (await this.db
            .insertInto('customShow')
            .values({
              uuid: customShow.id,
              name: customShow.name,
              createdAt: +dayjs(),
              updatedAt: +dayjs(),
            })
            .returningAll()
            .executeTakeFirstOrThrow());

        await this.db
          .deleteFrom('customShowContent')
          .where('customShowContent.customShowUuid', '=', entity.uuid)
          .execute();
        const content = customShowById[entity.uuid].content;

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

        const csContent: NewCustomShowContent[] = map(
          concat(
            sortBy(hasOrder, (c) => c.customOrder),
            newOrder,
          ),

          (c) =>
            ({
              index: c.customOrder!,
              customShowUuid: entity.uuid,
              contentUuid: persistedPrograms[uniqueProgramId(c)]?.uuid,
            }) satisfies NewCustomShowContent,
        );

        await this.db.transaction().execute(async (tx) => {
          for (const contentChunk of chunk(csContent, 50)) {
            await tx
              .insertInto('customShowContent')
              .values(contentChunk)
              .onConflict((oc) =>
                oc.doUpdateSet((eb) => {
                  return {
                    index: eb.ref('excluded.index'),
                  };
                }),
              )
              .execute();
          }
        });
      } else {
        const existing = await this.db
          .selectFrom('fillerShow')
          .selectAll()
          .where('fillerShow.uuid', '=', customShow.id)
          .select(withFillerPrograms)
          .executeTakeFirst();

        const entity =
          existing ??
          (await this.db
            .insertInto('fillerShow')
            .values({
              uuid: customShow.id,
              name: customShow.name,
              createdAt: +dayjs(),
              updatedAt: +dayjs(),
            })
            .returningAll()
            .executeTakeFirstOrThrow());

        await this.db
          .deleteFrom('customShowContent')
          .where('customShowContent.customShowUuid', '=', entity.uuid)
          .execute();

        const content = customShowById[entity.uuid].content;
        // Handle filler shows
        // These are selected randomly by the scheduler so we'll just zip them with
        // their index here.
        const programs = compact(
          map(content, (c) => persistedPrograms[uniqueProgramId(c)]),
        );
        const entities = map(
          programs,
          (program, index) =>
            ({
              index,
              programUuid: program.uuid,
              fillerShowUuid: entity.uuid,
            }) satisfies NewFillerShowContent,
        );

        await this.db.transaction().execute(async (tx) => {
          for (const contentChunk of chunk(entities, 50)) {
            await tx
              .insertInto('fillerShowContent')
              .values(contentChunk)
              .onConflict((oc) =>
                oc.doUpdateSet((eb) => ({
                  index: eb.ref('excluded.index'),
                })),
              )
              .execute();
          }
        });
      }
    });
  }
}
