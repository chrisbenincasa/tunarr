import { CustomProgram } from '@tunarr/types';
import {
  CreateCustomShowRequest,
  UpdateCustomShowRequest,
} from '@tunarr/types/api';
import { filter, isNil, map } from 'lodash-es';
import { MarkOptional } from 'ts-essentials';
import { isNonEmptyString } from '../util/index.js';
import { ProgramConverter } from './converters/programConverters.js';
import { getEm } from './dataSource.js';
import { CustomShow } from './entities/CustomShow.js';
import { CustomShowContent } from './entities/CustomShowContent.js';
import {
  createPendingProgramIndexMap,
  upsertContentPrograms,
} from './programHelpers.js';
import { directDbAccess } from './direct/directDbAccess.js';
import { withCustomShowPrograms } from './direct/programQueryHelpers.js';

export type CustomShowUpdate = MarkOptional<CustomShow, 'content'>;
export type CustomShowInsert = {
  uuid?: string;
  name: string;
  content?: string[];
};

export class CustomShowDB {
  #programConverter: ProgramConverter = new ProgramConverter();

  async getShow(id: string) {
    return getEm()
      .repo(CustomShow)
      .findOne(
        { uuid: id },
        { populate: ['content.uuid', 'content.duration'] },
      );
  }

  async getShowPrograms(id: string): Promise<CustomProgram[]> {
    const queryResult = await directDbAccess()
      .selectFrom('customShowContent')
      .where('customShowContent.customShowUuid', '=', id)
      .select((eb) => withCustomShowPrograms(eb))
      .execute();
    // const p = queryResult[0]
    // return map(queryResult, 'customShowContent');
    // const customShowContent = await getEm()
    //   .repo(CustomShowContent)
    //   .find(
    //     { customShow: id },
    //     {
    //       // Preload relations
    //       populate: [
    //         'content',
    //         'content.album',
    //         'content.artist',
    //         'content.tvShow',
    //         'content.season',
    //       ],
    //       orderBy: { index: 'desc' },
    //     },
    //   );

    return map(queryResult, ({ customShowContent }) => ({
      type: 'custom',
      persisted: true,
      duration: customShowContent.duration,
      program: this.#programConverter.directEntityToContentProgramSync(
        customShowContent,
        [],
      ),
      customShowId: id,
      index: customShowContent.index,
      id: customShowContent.uuid,
    }));
  }

  async saveShow(id: string, updateRequest: UpdateCustomShowRequest) {
    const em = getEm();
    const show = await this.getShow(id);

    if (isNil(show)) {
      return null;
    }

    if (updateRequest.programs) {
      const programIndexById = createPendingProgramIndexMap(
        updateRequest.programs,
      );

      const persisted = filter(
        updateRequest.programs,
        (p) => p.persisted && isNonEmptyString(p.id),
      );

      const upsertedPrograms = await upsertContentPrograms(
        updateRequest.programs,
      );

      const persistedCustomShowContent = map(persisted, (p) =>
        em.create(CustomShowContent, {
          customShow: show.uuid,
          content: p.id!,
          index: programIndexById[p.id!],
        }),
      );
      const newCustomShowContent = map(upsertedPrograms, (p) =>
        em.create(CustomShowContent, {
          customShow: show.uuid,
          content: p.uuid,
          index: programIndexById[p.uniqueId()],
        }),
      );

      await em.transactional(async (em) => {
        await em.nativeDelete(CustomShowContent, { customShow: show.uuid });
        await em.persistAndFlush([
          ...persistedCustomShowContent,
          ...newCustomShowContent,
        ]);
      });
    }

    if (updateRequest.name) {
      em.assign(show, { name: updateRequest.name });
    }

    await em.flush();

    return await em.refresh(show);
  }

  async createShow(createRequest: CreateCustomShowRequest) {
    const em = getEm();
    const show = em.repo(CustomShow).create({
      name: createRequest.name,
    });

    const programIndexById = createPendingProgramIndexMap(
      createRequest.programs,
    );

    const persisted = filter(createRequest.programs, (p) => p.persisted);

    const upsertedPrograms = await upsertContentPrograms(
      createRequest.programs,
    );

    await em.persist(show).flush();

    const persistedCustomShowContent = map(persisted, (p) =>
      em.create(CustomShowContent, {
        customShow: show.uuid,
        content: p.id!,
        index: programIndexById[p.id!],
      }),
    );
    const newCustomShowContent = map(upsertedPrograms, (p) =>
      em.create(CustomShowContent, {
        customShow: show.uuid,
        content: p.uuid,
        index: programIndexById[p.uniqueId()],
      }),
    );

    await em
      .persist([...persistedCustomShowContent, ...newCustomShowContent])
      .flush();

    return show.uuid;
  }

  async deleteShow(id: string) {
    const em = getEm();
    const show = await em.findOne(CustomShow, { uuid: id });
    if (!show) {
      return false;
    }

    await em.transactional(async (em) => {
      show.channels.removeAll();
      show.content.removeAll();
      await em.flush();
      await em.removeAndFlush(show);
    });

    return true;
  }

  async getAllShowsInfo() {
    const shows = await getEm()
      .repo(CustomShow)
      .findAll({ populate: ['content.uuid'] });
    return shows.map((f) => {
      return {
        id: f.uuid,
        name: f.name,
        count: f.content.length,
      };
    });
  }
}
