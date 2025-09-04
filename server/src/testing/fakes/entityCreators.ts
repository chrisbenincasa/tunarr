import { faker } from '@faker-js/faker';
import { MultiExternalIdType } from '@tunarr/types/schemas';
import type { Channel } from '../../db/schema/Channel.ts';
import type { ProgramDao } from '../../db/schema/Program.ts';
import { ProgramTypes } from '../../db/schema/Program.ts';
import type { MinimalProgramExternalId } from '../../db/schema/ProgramExternalId.ts';
import type { ProgramWithExternalIds } from '../../db/schema/derivedTypes.js';

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
    externalSourceId: faker.string.uuid(),
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
