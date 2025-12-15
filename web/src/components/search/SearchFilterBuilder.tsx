import { Clear, Help } from '@mui/icons-material';
import {
  Alert,
  FormControl,
  FormHelperText,
  IconButton,
  InputAdornment,
  Link,
  Stack,
  TextField,
  Tooltip,
} from '@mui/material';
import { useMatches } from '@tanstack/react-router';
import { search as tunarrSearch } from '@tunarr/shared/util';
import type { MediaSourceContentType } from '@tunarr/types';
import type { SearchFilter, SearchRequest } from '@tunarr/types/api';
import { useToggle } from '@uidotdev/usehooks';
import { isEmpty, isNil, last } from 'lodash-es';
import { useCallback, useMemo, useState } from 'react';
import type { FieldPathValue, SubmitHandler, Validate } from 'react-hook-form';
import { Controller, useFormContext } from 'react-hook-form';
import { difference, isNonEmptyString } from '../../helpers/util.ts';
import { useSearchQueryParser } from '../../hooks/useSearchQueryParser.ts';
import { Route } from '../../routes/__root.tsx';
import type { Nullable } from '../../types/util.ts';
import { PointAndClickSearchBuilder } from '../library/PointAndClickSearchBuilder.tsx';
import type { SearchForm } from '../library/SearchInput.tsx';
import { SearchInputToggle } from '../library/SearchInputToggle.tsx';
import { CreateSmartCollectionDialog } from '../smart_collections/CreateSmartCollectionDialog.tsx';
import { AllSearchRestrictKeys } from './SearchFieldRestrictMenu.tsx';

type SearchBuilderProps = {
  onSearch: (query: SearchRequest) => void;
  initialQuery?: string;
  // If we're focused on a specific media / library, filter available
  // field options
  mediaTypeFilter?: MediaSourceContentType;
};

export type QueryBuilderType = 'text' | 'click';

export function SearchFilterBuilder({
  onSearch,
  initialQuery,
  mediaTypeFilter,
}: SearchBuilderProps) {
  const navigate = Route.useNavigate();
  const routeMatch = useMatches();
  const [searchRestrictEl, setSearchRestrictEl] =
    useState<Nullable<HTMLElement>>(null);
  const [searchRestrctState, setSearchRestrictState] = useState<
    ReadonlySet<string>
  >(AllSearchRestrictKeys);
  const [smartCollectionModalOpen, toggleSmartCollectionModal] =
    useToggle(false);
  const [isStructuredSearch, setIsStructuredSearch] = useState(false);
  const [queryBuilderType, setQueryBuilderType] =
    useState<QueryBuilderType>('text');

  const formMethods = useFormContext<SearchForm>();
  const { setValue, getValues } = formMethods;

  const { getSearchExpression } = useSearchQueryParser();
  const [query] = formMethods.watch(['filter']);

  const expr = useMemo(() => {
    if (isNonEmptyString(query)) {
      const result = getSearchExpression(query);
      const isStructured = result?.type === 'success';
      setIsStructuredSearch(isStructured);
      return result;
    }
    setIsStructuredSearch(false);
    return;
  }, [query, getSearchExpression]);

  const handleQueryTypeChange = useCallback(
    (queryBuilderType: QueryBuilderType) => {
      const currentFilter = getValues('filter');
      setQueryBuilderType(queryBuilderType);
      if (queryBuilderType === 'click') {
        let filter: SearchFilter = {
          type: 'op',
          children: [],
          op: 'and',
        };
        if (currentFilter.type === 'text') {
          const result = getSearchExpression(currentFilter.expression);
          if (result?.type === 'success') {
            filter = tunarrSearch.parsedSearchToRequest(result.query);
          }
        }
        // getSearchExpression()
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

  const handleSearch: SubmitHandler<SearchRequest> = useCallback(
    (data) => {
      const search: SearchRequest = data;
      // If we successfully parsed the search query, it's structured. Otherwise
      // we just treat it as a raw query.
      const currentParams = new URLSearchParams(window.location.search);
      if (isNonEmptyString(query)) {
        currentParams.set('query', query);
      } else {
        currentParams.delete('query');
      }

      if (last(routeMatch)?.pathname.startsWith('/search')) {
        window.history.replaceState(
          {},
          '',
          `${window.location.pathname}?${currentParams.toString()}`,
        );
      }

      if (expr && expr.type === 'success') {
        search.query = null;
        search.filter = tunarrSearch.parsedSearchToRequest(expr.query);
      } else {
        expr?.errors.forEach((err) => console.error(err));
      }
      onSearch({
        ...search,
        restrictSearchTo:
          isEmpty(searchRestrctState) ||
          difference(AllSearchRestrictKeys, searchRestrctState).size === 0
            ? undefined
            : [...searchRestrctState],
      });
    },
    [expr, onSearch, query, routeMatch, searchRestrctState],
  );

  const handleClear = () => {
    formMethods.setValue('query', '');
    navigate({
      to: last(routeMatch)?.pathname,
      search: {},
      replace: true,
    }).catch(console.error);
    handleSearch(formMethods.getValues());
  };

  const validateFilterExpression: Validate<
    FieldPathValue<SearchForm, 'filter.expression'>,
    SearchForm
  > = useCallback(
    (value) => {
      if (isNil(value) || isEmpty(value)) {
        return true;
      }
      const expr = getSearchExpression(value);
      if (!expr || expr.type === 'error') {
        return false;
      }
      return true;
    },
    [getSearchExpression],
  );

  return (
    <>
      <Stack gap={2}>
        {queryBuilderType === 'text' ? (
          <Stack direction="row" gap={2} alignItems={'center'}>
            <Controller
              name="filter.expression"
              control={formMethods.control}
              rules={{
                validate: {
                  validExpression: validateFilterExpression,
                },
              }}
              render={({ field, fieldState }) => {
                return (
                  <>
                    <TextField
                      label="Filter"
                      error={!!fieldState.error}
                      helperText={
                        fieldState.error?.type === 'validExpression' ? (
                          <span>
                            Could not parse this filter expression. Check the{' '}
                            <Link
                              href="https://tunarr.com/misc/search"
                              target="_blank"
                            >
                              documentation
                            </Link>{' '}
                            for information about filter expressions.
                          </span>
                        ) : (
                          <span> </span>
                        )
                      }
                      slotProps={{
                        input: {
                          spellCheck: false,
                          endAdornment: (
                            <>
                              {isNonEmptyString(field.value) && (
                                <InputAdornment position="end">
                                  <IconButton onClick={() => handleClear()}>
                                    <Clear />
                                  </IconButton>
                                </InputAdornment>
                              )}
                              <InputAdornment position="end">
                                <Tooltip
                                  title="Add a filter expression to fine-tune results of the search"
                                  placement="top"
                                  sx={{ textAlign: 'center' }}
                                  slotProps={{
                                    popper: {
                                      sx: {
                                        textAlign: 'center',
                                      },
                                    },
                                  }}
                                >
                                  <IconButton>
                                    <Help />
                                  </IconButton>
                                </Tooltip>
                              </InputAdornment>
                            </>
                          ),
                        },
                      }}
                      fullWidth
                      {...field}
                    />
                    <FormControl sx={{ minWidth: '96px' }}>
                      <SearchInputToggle
                        queryBuilderType={queryBuilderType}
                        onQueryBuilderTypeChange={(type) =>
                          handleQueryTypeChange(type)
                        }
                      />
                      <FormHelperText>
                        {fieldState.error?.type === 'validExpression' ? (
                          ' '
                        ) : (
                          <span> </span>
                        )}
                      </FormHelperText>
                    </FormControl>
                  </>
                );
              }}
            />
          </Stack>
        ) : (
          <PointAndClickSearchBuilder />
        )}
        {!isStructuredSearch && isNonEmptyString(query) && (
          <Alert severity="info">
            Tunarr is interpretting this query as a "free text" query. This
            means the query is taken verbatim and searched across all fields. If
            you are intending to use a "structured" query (e.g. &nbsp;
            <code>title:"ABC"</code>) and are seeing this message, there is a
            syntax error or unsupported field in your query.
          </Alert>
        )}
      </Stack>
      <CreateSmartCollectionDialog
        open={smartCollectionModalOpen}
        onClose={() => toggleSmartCollectionModal(false)}
        initialQuery={query}
      />
    </>
  );
}
