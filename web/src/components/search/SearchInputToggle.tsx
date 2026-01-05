import { Keyboard, Mouse } from '@mui/icons-material';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import { search as tunarrSearch } from '@tunarr/shared/util';
import { SearchFilter } from '@tunarr/types/api';
import { useCallback } from 'react';
import { useFormContext } from 'react-hook-form';
import { useSearchQueryParser } from '../../hooks/useSearchQueryParser.ts';
import type { Nullable } from '../../types/util.ts';
import { QueryBuilderType, SearchForm } from './SearchInput.tsx';

export const SearchInputToggle = () => {
  const { getValues, setValue, watch } = useFormContext<SearchForm>();
  const [queryBuilderType] = watch(['queryBuilderType']);
  const { getSearchExpression } = useSearchQueryParser();
  const handleQueryTypeChange = useCallback(
    (newQueryBuilderType: Nullable<QueryBuilderType>) => {
      if (!newQueryBuilderType) {
        return;
      }
      const currentFilter = getValues('filter');
      setValue('queryBuilderType', newQueryBuilderType, {
        shouldDirty: true,
        shouldTouch: true,
      });
      if (newQueryBuilderType === 'click') {
        let filter: SearchFilter = {
          type: 'op',
          children: [],
          op: 'and',
        };
        if (currentFilter.type === 'text') {
          const result = getSearchExpression(currentFilter.expression);
          if (result?.type === 'success') {
            filter = tunarrSearch.parsedSearchToRequest(result.query);
          } else {
            console.error(result?.errors);
          }
        }

        // If we have a single value filter, wrap it in an AND to appease the UI
        if (filter.type === 'value') {
          filter = {
            type: 'op',
            op: 'and',
            children: [filter],
          };
        }

        setValue(
          'filter',
          {
            type: 'structured',
            filter,
          },
          {
            shouldDirty: true,
          },
        );
      } else {
        setValue('filter', {
          type: 'text',
          expression:
            currentFilter.type === 'structured'
              ? tunarrSearch.searchFilterToString(currentFilter.filter)
              : '',
        });
      }
    },
    [getSearchExpression, getValues, setValue],
  );

  return (
    <ToggleButtonGroup
      value={queryBuilderType}
      onChange={(_, v) => {
        handleQueryTypeChange(v as Nullable<QueryBuilderType>);
      }}
      exclusive
    >
      <ToggleButton value="text">
        <Keyboard />
      </ToggleButton>
      <ToggleButton value="click">
        <Mouse />
      </ToggleButton>
    </ToggleButtonGroup>
  );
};
