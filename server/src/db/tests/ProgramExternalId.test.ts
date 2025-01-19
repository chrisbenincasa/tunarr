import { ProgramExternalIdType } from '@/custom_types/ProgramExternalIdType.js';
import { ProgramExternalId } from '@/entities/ProgramExternalId.js';

test('should convert single IDs', () => {
  const eid = new ProgramExternalId();
  eid.sourceType = ProgramExternalIdType.PLEX_GUID;
  eid.externalKey = 'guid';

  const dto = eid.toExternalId();
  expect(dto).toMatchObject({
    type: 'single',
    source: 'plex-guid',
    id: 'guid',
  });
});

test('should convert multi IDs', () => {
  const eid = new ProgramExternalId();
  eid.sourceType = ProgramExternalIdType.PLEX;
  (eid.externalSourceId = 'server'), (eid.externalKey = 'key');

  expect(eid.toExternalId()).toMatchObject({
    type: 'multi',
    id: 'key',
    source: 'plex',
    sourceId: 'server',
  });
});

test('undefined for single type mismatches', () => {
  const eid = new ProgramExternalId();
  eid.sourceType = ProgramExternalIdType.PLEX_GUID;
  eid.externalKey = 'guid';
  eid.externalSourceId = 'server';

  const dto = eid.toExternalId();
  expect(dto).toBeUndefined();
});

test('undefined for multi type mismatches', () => {
  const eid = new ProgramExternalId();
  eid.sourceType = ProgramExternalIdType.PLEX;
  eid.externalKey = 'guid';

  const dto = eid.toExternalId();
  expect(dto).toBeUndefined();
});
