import { SearchFilterValueNode } from '@tunarr/types/schemas';
import { describe, expect, test } from 'vitest';
import { MediaSourceLibraryOrm } from '../../db/schema/MediaSourceLibrary.ts';
import { encodeCaseSensitiveId } from '../MeilisearchService.ts';
import { LibraryNameSearchMutator } from './LibraryNameSearchMutator.ts';

const createLibrary = (
  uuid: string,
  name: string,
): Pick<MediaSourceLibraryOrm, 'uuid' | 'name'> => ({
  uuid,
  name,
});

describe('LibraryNameSearchMutator', () => {
  const libraries = [
    createLibrary('lib-uuid-1', 'Movies'),
    createLibrary('lib-uuid-2', 'TV Shows'),
    createLibrary('lib-uuid-3', 'Music'),
  ] as MediaSourceLibraryOrm[];

  describe('appliesTo', () => {
    const mutator = new LibraryNameSearchMutator(libraries);

    test('returns true for library_name field with string type', () => {
      const node: SearchFilterValueNode = {
        type: 'value',
        fieldSpec: {
          key: 'library_name',
          name: 'library_name',
          type: 'string',
          op: '=',
          value: ['Movies'],
        },
      };

      expect(mutator.appliesTo(node)).toBe(true);
    });

    test('returns false for different field name', () => {
      const node: SearchFilterValueNode = {
        type: 'value',
        fieldSpec: {
          key: 'libraryId',
          name: 'libraryId',
          type: 'string',
          op: '=',
          value: ['lib-uuid-1'],
        },
      };

      expect(mutator.appliesTo(node)).toBe(false);
    });

    test('returns false for library_name field with non-string type', () => {
      const node: SearchFilterValueNode = {
        type: 'value',
        fieldSpec: {
          key: 'library_name',
          name: 'library_name',
          type: 'numeric',
          op: '=',
          value: 123,
        },
      };

      expect(mutator.appliesTo(node)).toBe(false);
    });
  });

  describe('mutate', () => {
    const mutator = new LibraryNameSearchMutator(libraries);

    test('transforms library_name to libraryId with encoded uuid', () => {
      const node: SearchFilterValueNode = {
        type: 'value',
        fieldSpec: {
          key: 'library_name',
          name: 'library_name',
          type: 'string',
          op: '=',
          value: ['Movies'],
        },
      };

      const result = mutator.mutate(node);

      expect(result.fieldSpec.key).toBe('libraryId');
      expect(result.fieldSpec.type).toBe('string');
      expect((result.fieldSpec as { value: string[] }).value).toEqual([
        encodeCaseSensitiveId('lib-uuid-1'),
      ]);
    });

    test('transforms multiple library names', () => {
      const node: SearchFilterValueNode = {
        type: 'value',
        fieldSpec: {
          key: 'library_name',
          name: 'library_name',
          type: 'string',
          op: 'in',
          value: ['Movies', 'TV Shows'],
        },
      };

      const result = mutator.mutate(node);

      expect(result.fieldSpec.key).toBe('libraryId');
      expect((result.fieldSpec as { value: string[] }).value).toEqual([
        encodeCaseSensitiveId('lib-uuid-1'),
        encodeCaseSensitiveId('lib-uuid-2'),
      ]);
    });

    test('filters out non-existent library names', () => {
      const node: SearchFilterValueNode = {
        type: 'value',
        fieldSpec: {
          key: 'library_name',
          name: 'library_name',
          type: 'string',
          op: 'in',
          value: ['Movies', 'Non-Existent Library', 'TV Shows'],
        },
      };

      const result = mutator.mutate(node);

      expect(result.fieldSpec.key).toBe('libraryId');
      expect((result.fieldSpec as { value: string[] }).value).toEqual([
        encodeCaseSensitiveId('lib-uuid-1'),
        encodeCaseSensitiveId('lib-uuid-2'),
      ]);
    });

    test('returns empty array when no libraries match', () => {
      const node: SearchFilterValueNode = {
        type: 'value',
        fieldSpec: {
          key: 'library_name',
          name: 'library_name',
          type: 'string',
          op: '=',
          value: ['Non-Existent Library'],
        },
      };

      const result = mutator.mutate(node);

      expect(result.fieldSpec.key).toBe('libraryId');
      expect((result.fieldSpec as { value: string[] }).value).toEqual([]);
    });

    test('preserves other fieldSpec properties', () => {
      const node: SearchFilterValueNode = {
        type: 'value',
        fieldSpec: {
          key: 'library_name',
          name: 'Library',
          type: 'string',
          op: 'in',
          value: ['Movies'],
        },
      };

      const result = mutator.mutate(node);

      expect(result.type).toBe('value');
      expect(result.fieldSpec.name).toBe('Library');
      expect(result.fieldSpec.op).toBe('in');
    });

    test('returns original node unchanged for non-string type', () => {
      const node: SearchFilterValueNode = {
        type: 'value',
        fieldSpec: {
          key: 'library_name',
          name: 'library_name',
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
          key: 'library_name',
          name: 'library_name',
          type: 'string',
          op: 'in',
          value: [],
        },
      };

      const result = mutator.mutate(node);

      expect(result.fieldSpec.key).toBe('libraryId');
      expect((result.fieldSpec as { value: string[] }).value).toEqual([]);
    });
  });

  describe('with empty libraries', () => {
    const mutator = new LibraryNameSearchMutator([]);

    test('returns empty value array when no libraries configured', () => {
      const node: SearchFilterValueNode = {
        type: 'value',
        fieldSpec: {
          key: 'library_name',
          name: 'library_name',
          type: 'string',
          op: '=',
          value: ['Movies'],
        },
      };

      const result = mutator.mutate(node);

      expect(result.fieldSpec.key).toBe('libraryId');
      expect((result.fieldSpec as { value: string[] }).value).toEqual([]);
    });
  });
});
