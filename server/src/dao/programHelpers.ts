import {
  ChannelProgram,
  ContentProgram,
  CustomProgram,
  isContentProgram,
  isCustomProgram,
} from '@tunarr/types';
import { chain, chunk, filter, flatten, reduce } from 'lodash-es';
import { ProgramMinterFactory } from '../util/programMinter.js';
import { getEm } from './dataSource.js';
import { Program } from './entities/Program.js';
import { mapAsyncSeq } from '../util.js';
import createLogger from '../logger.js';

const logger = createLogger(import.meta);

export async function upsertContentPrograms(
  programs: ChannelProgram[],
  batchSize: number = 10,
) {
  const em = getEm();
  const nonPersisted = filter(programs, (p) => !p.persisted);
  const minter = ProgramMinterFactory.create(em);

  // TODO handle custom shows
  const programsToPersist = chain(nonPersisted)
    .filter(isContentProgram)
    .uniqBy((p) => p.uniqueId)
    .map((p) => minter.mint(p.externalSourceName!, p.originalProgram!))
    .value();

  logger.debug('Upserting %d programs', programsToPersist.length);

  return flatten(
    await mapAsyncSeq(
      chunk(programsToPersist, batchSize),
      undefined,
      (programs) =>
        em.upsertMany(Program, programs, {
          onConflictAction: 'merge',
          onConflictFields: ['sourceType', 'externalSourceId', 'externalKey'],
          onConflictExcludeFields: ['uuid'],
        }),
    ),
  );
}

// Takes a listing of programs and makes a mapping of a unique identifier,
// which may differ when a program is persisted or not, to the original
// index in the list. This is useful for when the pending list may lose
// its original ordering during processing, bur requires ordering later
// on in processing
export function createPendingProgramIndexMap(
  programs: (ContentProgram | CustomProgram)[],
) {
  let idx = 0;
  return reduce(
    programs,
    (acc, p) => {
      if (p.persisted || isCustomProgram(p)) {
        acc[p.id!] = idx++;
        // TODO handle other types of programs
      } else if (isContentProgram(p)) {
        acc[contentProgramUniqueId(p)] = idx++;
      }
      return acc;
    },
    {} as Record<string, number>,
  );
}

// Creates a unique ID that matches the output of the entity Program#uniqueId
// function. Useful to matching non-persisted API programs with persisted programs
export function contentProgramUniqueId(p: ContentProgram) {
  // ID should always be defined in the persistent case
  if (p.persisted) {
    return p.id!;
  }

  // These should always be defined for the non-persisted case
  return `${p.externalSourceType}|${p.externalSourceName}|${p.originalProgram?.key}`;
}
