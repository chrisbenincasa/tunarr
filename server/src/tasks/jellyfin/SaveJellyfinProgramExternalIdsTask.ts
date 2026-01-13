import type { IProgramDB } from '@/db/interfaces/IProgramDB.js';
import { MediaSourceApiFactory } from '@/external/MediaSourceApiFactory.js';
import type { JellyfinApiClient } from '@/external/jellyfin/JellyfinApiClient.js';
import { Task2 } from '@/tasks/Task.js';
import type { Maybe } from '@/types/util.js';
import { isDefined, isNonEmptyString } from '@/util/index.js';
import dayjs from 'dayjs';
import { inject, injectable } from 'inversify';
import { compact, isEmpty, isUndefined, map } from 'lodash-es';
import { Dictionary } from 'ts-essentials';
import { v4 } from 'uuid';
import z from 'zod';
import {
  ProgramExternalIdType,
  programExternalIdTypeFromJellyfinProvider,
} from '../../db/custom_types/ProgramExternalIdType.ts';
import type {
  MinimalProgramExternalId,
  NewSingleOrMultiExternalId,
  ProgramExternalId,
} from '../../db/schema/ProgramExternalId.ts';
import { KEYS } from '../../types/inject.ts';
import { Logger } from '../../util/logging/LoggerFactory.ts';

export type SaveJellyfinProgramExternalIdsTaskFactory = (
  programId: string,
) => SaveJellyfinProgramExternalIdsTask;

export const SaveJellyfinProgramExternalIdsTaskRequest = z.object({
  programId: z.string(),
});

export type SaveJellyfinProgramExternalIdsTaskRequest = z.infer<
  typeof SaveJellyfinProgramExternalIdsTaskRequest
>;

@injectable()
export class SaveJellyfinProgramExternalIdsTask extends Task2<
  typeof SaveJellyfinProgramExternalIdsTaskRequest,
  Maybe<Dictionary<ProgramExternalId[]>>
> {
  static KEY = Symbol.for(SaveJellyfinProgramExternalIdsTask.name);
  ID = SaveJellyfinProgramExternalIdsTask.name;
  schema = SaveJellyfinProgramExternalIdsTaskRequest;

  constructor(
    @inject(KEYS.Logger) logger: Logger,
    @inject(KEYS.ProgramDB)
    private programDB: IProgramDB,
    @inject(MediaSourceApiFactory)
    private mediaSourceApiFactory: MediaSourceApiFactory,
  ) {
    super(logger);
  }

  protected async runInternal({
    programId,
  }: SaveJellyfinProgramExternalIdsTaskRequest): Promise<
    Maybe<Dictionary<ProgramExternalId[]>>
  > {
    const program = await this.programDB.getProgramById(programId);

    if (!program) {
      throw new Error('Program not found: ID = ' + programId);
    }

    const jellyfinIds = program.externalIds.filter(
      (eid) =>
        eid.sourceType === ProgramExternalIdType.JELLYFIN.toString() &&
        isNonEmptyString(eid.externalSourceId),
    );

    if (isEmpty(jellyfinIds)) {
      return;
    }

    let chosenId: Maybe<MinimalProgramExternalId> = undefined;
    let api: Maybe<JellyfinApiClient>;
    for (const id of jellyfinIds) {
      if (!isNonEmptyString(id.mediaSourceId)) {
        continue;
      }

      api = await this.mediaSourceApiFactory.getJellyfinApiClientById(
        id.mediaSourceId,
      );

      if (isDefined(api)) {
        chosenId = id;
        break;
      }
    }

    if (isUndefined(api) || isUndefined(chosenId)) {
      return;
    }

    const metadataResult = await api.getRawItem(chosenId.externalKey);

    if (metadataResult.isFailure()) {
      this.logger.error(
        'Error querying Jellyfin for item %s',
        chosenId.externalKey,
      );
      return;
    }

    const metadata = metadataResult.get();

    const eids = compact(
      map(metadata?.ProviderIds, (id, provider) => {
        if (!isNonEmptyString(id)) {
          return;
        }

        const type = programExternalIdTypeFromJellyfinProvider(provider);
        if (!type) {
          return;
        }

        return {
          type: 'single',
          uuid: v4(),
          createdAt: +dayjs(),
          updatedAt: +dayjs(),
          externalKey: id,
          sourceType: type,
          programUuid: program.uuid,
        } satisfies NewSingleOrMultiExternalId;
      }),
    );

    return await this.programDB.upsertProgramExternalIds(eids);
  }

  get taskName() {
    return SaveJellyfinProgramExternalIdsTask.name;
  }
}
