import type { SearchFilter } from '@tunarr/types/api';
import { useCallback } from 'react';
import type { FieldPath } from 'react-hook-form';
import type { FieldKey, FieldPrefix } from '../types/SearchBuilder.ts';

export const useGetFieldName = (formKey: FieldPrefix) => {
  return useCallback(
    <T extends FieldPath<SearchFilter>>(field: T): FieldKey<FieldPrefix, T> => {
      return `${formKey}.${field}`;
    },
    [formKey],
  );
};
