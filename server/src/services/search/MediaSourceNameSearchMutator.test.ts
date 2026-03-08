import { SearchFilterValueNode } from '@tunarr/types/schemas';
import { describe, expect, test } from 'vitest';
import { MediaSourceOrm } from '../../db/schema/MediaSource.ts';
import { MediaSourceNameSearchMutator } from './MediaSourceNameSearchMutator.ts';

const createMediaSource = (
  uuid: string,
  name: string,
): Pick<MediaSourceOrm, 'uuid' | 'name'> => ({
  uuid,
  name,
});

describe('MediaSourceNameSearchMutator', () => {
  const mediaSources = [
    createMediaSource('uuid-1', 'Plex Server'),
    createMediaSource('uuid-2', 'Jellyfin'),
    createMediaSource('uuid-3', 'Local Media'),
  ] as MediaSourceOrm[];

  describe('appliesTo', () => {
    const mutator = new MediaSourceNameSearchMutator(mediaSources);

    test('returns true for media_source_name field with string type', () => {
      const node: SearchFilterValueNode = {
        type: 'value',
        fieldSpec: {
          key: 'media_source_name',
          name: 'media_source_name',
          type: 'string',
          op: '=',
          value: ['Plex Server'],
        },
      };

      expect(mutator.appliesTo(node)).toBe(true);
    });

    test('returns false for different field name', () => {
      const node: SearchFilterValueNode = {
        type: 'value',
        fieldSpec: {
          key: 'mediaSourceId',
          name: 'mediaSourceId',
          type: 'string',
          op: '=',
          value: ['uuid-1'],
        },
      };

      expect(mutator.appliesTo(node)).toBe(false);
    });

    test('returns false for media_source_name field with non-string type', () => {
      const node: SearchFilterValueNode = {
        type: 'value',
        fieldSpec: {
          key: 'media_source_name',
          name: 'media_source_name',
          type: 'numeric',
          op: '=',
          value: 123,
        },
      };

      expect(mutator.appliesTo(node)).toBe(false);
    });
  });

  describe('mutate', () => {
    const mutator = new MediaSourceNameSearchMutator(mediaSources);

    test('transforms media_source_name to mediaSourceId with encoded uuid', () => {
      const node: SearchFilterValueNode = {
        type: 'value',
        fieldSpec: {
          key: 'media_source_name',
          name: 'media_source_name',
          type: 'string',
          op: '=',
          value: ['Plex Server'],
        },
      };

      const result = mutator.mutate(node);

      expect(result.fieldSpec.key).toBe('mediaSourceId');
      expect(result.fieldSpec.type).toBe('string');
      expect((result.fieldSpec as { value: string[] }).value).toEqual([
        'uuid-1',
      ]);
    });

    test('transforms multiple media source names', () => {
      const node: SearchFilterValueNode = {
        type: 'value',
        fieldSpec: {
          key: 'media_source_name',
          name: 'media_source_name',
          type: 'string',
          op: 'in',
          value: ['Plex Server', 'Jellyfin'],
        },
      };

      const result = mutator.mutate(node);

      expect(result.fieldSpec.key).toBe('mediaSourceId');
      expect((result.fieldSpec as { value: string[] }).value).toEqual([
        'uuid-1',
        'uuid-2',
      ]);
    });

    test('filters out non-existent media source names', () => {
      const node: SearchFilterValueNode = {
        type: 'value',
        fieldSpec: {
          key: 'media_source_name',
          name: 'media_source_name',
          type: 'string',
          op: 'in',
          value: ['Plex Server', 'Non-Existent Server', 'Jellyfin'],
        },
      };

      const result = mutator.mutate(node);

      expect(result.fieldSpec.key).toBe('mediaSourceId');
      expect((result.fieldSpec as { value: string[] }).value).toEqual([
        'uuid-1',
        'uuid-2',
      ]);
    });

    test('returns empty array when no media sources match', () => {
      const node: SearchFilterValueNode = {
        type: 'value',
        fieldSpec: {
          key: 'media_source_name',
          name: 'media_source_name',
          type: 'string',
          op: '=',
          value: ['Non-Existent Server'],
        },
      };

      const result = mutator.mutate(node);

      expect(result.fieldSpec.key).toBe('mediaSourceId');
      expect((result.fieldSpec as { value: string[] }).value).toEqual([]);
    });

    test('preserves other fieldSpec properties', () => {
      const node: SearchFilterValueNode = {
        type: 'value',
        fieldSpec: {
          key: 'media_source_name',
          name: 'Media Source',
          type: 'string',
          op: 'in',
          value: ['Plex Server'],
        },
      };

      const result = mutator.mutate(node);

      expect(result.type).toBe('value');
      expect(result.fieldSpec.name).toBe('Media Source');
      expect(result.fieldSpec.op).toBe('in');
    });

    test('returns original node unchanged for non-string type', () => {
      const node: SearchFilterValueNode = {
        type: 'value',
        fieldSpec: {
          key: 'media_source_name',
          name: 'media_source_name',
          type: 'numeric',
          op: '=',
          value: 123,
        },
      };

      const result = mutator.mutate(node);

      expect(result).toEqual(node);
    });

    test('handles empty value array', () => {
      const node: SearchFilterValueNode = {
        type: 'value',
        fieldSpec: {
          key: 'media_source_name',
          name: 'media_source_name',
          type: 'string',
          op: 'in',
          value: [],
        },
      };

      const result = mutator.mutate(node);

      expect(result.fieldSpec.key).toBe('mediaSourceId');
      expect((result.fieldSpec as { value: string[] }).value).toEqual([]);
    });
  });

  describe('with empty media sources', () => {
    const mutator = new MediaSourceNameSearchMutator([]);

    test('returns empty value array when no media sources configured', () => {
      const node: SearchFilterValueNode = {
        type: 'value',
        fieldSpec: {
          key: 'media_source_name',
          name: 'media_source_name',
          type: 'string',
          op: '=',
          value: ['Plex Server'],
        },
      };

      const result = mutator.mutate(node);

      expect(result.fieldSpec.key).toBe('mediaSourceId');
      expect((result.fieldSpec as { value: string[] }).value).toEqual([]);
    });
  });
});
