import {
  ChannelProgram,
  ContentProgram,
  CustomProgram,
  isContentProgram,
} from '@tunarr/types';
import { chain, filter, reduce } from 'lodash-es';
import { ProgramMinterFactory } from '../util/programMinter.js';
import { getEm } from './dataSource.js';
import { Program } from './entities/Program.js';

export async function upsertContentPrograms(programs: ChannelProgram[]) {
  const em = getEm();
  const nonPersisted = filter(programs, (p) => !p.persisted);
  const minter = ProgramMinterFactory.create(em);

  // TODO handle custom shows
  const programsToPersist = chain(nonPersisted)
    .filter(isContentProgram)
    .map((p) => minter.mint(p.externalSourceName!, p.originalProgram!))
    .value();

  return await em.upsertMany(Program, programsToPersist, {
    batchSize: 10,
    onConflictAction: 'merge',
    onConflictFields: ['sourceType', 'externalSourceId', 'externalKey'],
    onConflictExcludeFields: ['uuid'],
  });
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
      if (p.persisted) {
        acc[p.id!] = idx++;
        // TODO handle other types of programs
      } else if (isContentProgram(p)) {
        acc[
          `${p.externalSourceType}_${p.externalSourceName!}_${p.originalProgram
            ?.key}`
        ] = idx++;
      }
      return acc;
    },
    {} as Record<string, number>,
  );
}
