import { faker } from '@faker-js/faker';
import { tag } from '@tunarr/types';
import { MultiExternalIdType } from '@tunarr/types/schemas';
import type { Channel } from '../../db/schema/Channel.ts';
import type { ProgramDao } from '../../db/schema/Program.ts';
import { ProgramTypes } from '../../db/schema/Program.ts';
import type { MinimalProgramExternalId } from '../../db/schema/ProgramExternalId.ts';
import type { MediaSourceName } from '../../db/schema/base.js';
import { type MediaSourceId } from '../../db/schema/base.js';
import type {
  ProgramWithExternalIds,
  ProgramWithRelationsOrm,
} from '../../db/schema/derivedTypes.js';

export function createChannel(overrides?: Partial<Channel>): Channel {
  return {
    uuid: faker.string.uuid(),
    duration: faker.number.int({ min: 0 }),
    startTime: faker.date.past().getTime(),
    createdAt: null,
    disableFillerOverlay: faker.datatype.boolean() ? 1 : 0,
    name: faker.music.artist(),
    ...(overrides ?? {}),
  } satisfies Channel;
}

export function createFakeMultiExternalId(): MinimalProgramExternalId {
  const typ = faker.helpers.arrayElement(MultiExternalIdType);
  return {
    sourceType: typ,
    externalKey: faker.string.alphanumeric(),
    externalSourceId: tag<MediaSourceName>(faker.string.alphanumeric()),
    mediaSourceId: tag<MediaSourceId>(faker.string.uuid()),
  } satisfies MinimalProgramExternalId;
}

export function createFakeProgram(
  overrides?: Partial<ProgramDao>,
): ProgramWithExternalIds {
  return {
    uuid: faker.string.uuid(), // programId2,
    duration: faker.number.int({ min: 1 }), //lineup[1].durationMs,
    year: faker.date.past().getFullYear(),
    title: faker.music.songName(),
    externalIds: [createFakeMultiExternalId()],
    type: faker.helpers.arrayElement(ProgramTypes),
    summary: faker.lorem.sentences(),
    ...(overrides ?? {}),
  } satisfies ProgramWithExternalIds;
}

export function createFakeProgramOrm(
  overrides?: Partial<ProgramWithRelationsOrm>,
): ProgramWithRelationsOrm {
  const uuid = faker.string.uuid();
  return {
    uuid: uuid, // programId2,
    duration: faker.number.int({ min: 1 }), //lineup[1].durationMs,
    year: faker.date.past().getFullYear(),
    title: faker.music.songName(),
    externalIds: [
      {
        sourceType: faker.helpers.arrayElement(MultiExternalIdType),
        externalKey: faker.string.alphanumeric(),
        externalSourceId: tag<MediaSourceName>(faker.string.alphanumeric()),
        mediaSourceId: tag<MediaSourceId>(faker.string.uuid()),
        createdAt: 0,
        uuid: faker.string.uuid(),
        updatedAt: 0,
        programUuid: uuid,
        directFilePath: null,
        externalFilePath: null,
      },
    ],
    type: faker.helpers.arrayElement(ProgramTypes),
    summary: faker.lorem.sentences(),
    ...(overrides ?? {}),
  } satisfies ProgramWithRelationsOrm;
}
