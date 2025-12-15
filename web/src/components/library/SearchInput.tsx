import { Clear, FilterList, Help, Save, Search } from '@mui/icons-material';
import {
  Box,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
} from '@mui/material';
import { useMatches } from '@tanstack/react-router';
import { isNonEmptyString, search as tunarrSearch } from '@tunarr/shared/util';
import type { MediaSourceLibrary, MediaSourceSettings } from '@tunarr/types';
import type { SearchFilter, SearchRequest } from '@tunarr/types/api';
import { difference, isEmpty, last } from 'lodash-es';
import { useCallback, useMemo, useState } from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { useSearchQueryParser } from '../../hooks/useSearchQueryParser.ts';
import { setSearchRequest } from '../../store/programmingSelector/actions.ts';
import type { Maybe, Nullable } from '../../types/util.ts';
import {
  AllSearchRestrictKeys,
  SearchFieldRestrictMenu,
} from '../search/SearchFieldRestrictMenu.tsx';
import { SearchFilterBuilder } from '../search/SearchFilterBuilder.tsx';

type Props = {
  mediaSource?: MediaSourceSettings;
  library?: MediaSourceLibrary;
  initialSearchQuery?: string;
  onSearch: (query: SearchRequest) => void;
};

type SearchFilterFormInput =
  | {
      type: 'text';
      expression: string;
    }
  | {
      type: 'structured';
      filter: SearchFilter;
    };

export type SearchForm = {
  keywords: string;
  filter: SearchFilterFormInput;
};

export const SearchInput = (props: Props) => {
  const routeMatch = useMatches();
  const formMethods = useForm<SearchForm>({
    defaultValues: {
      filter: {
        type: 'text',
        expression: '',
      },
      keywords: '',
      // query: props.initialSearchQuery ?? '',
      // filter: null,
      // sort: null,
    },
    mode: 'onChange',
  });

  const { getSearchExpression } = useSearchQueryParser();
  const [filter] = formMethods.watch(['filter']);

  const expr = useMemo(() => {
    if (filter.type === 'text' && isNonEmptyString(filter.expression)) {
      const result = getSearchExpression(filter.expression);
      const isStructured = result?.type === 'success';
      // setIsStructuredSearch(isStructured);
      return result;
    }
    // setIsStructuredSearch(false);
    return;
  }, [filter, getSearchExpression]);

  const { initialSearchQuery, onSearch } = props;

  const handleSearchChange = useCallback((searchRequest: SearchRequest) => {
    setSearchRequest(searchRequest);
  }, []);

  const [keywordSearch, setKeywordSearch] = useState('');

  const [searchRestrictEl, setSearchRestrictEl] =
    useState<Nullable<HTMLElement>>(null);

  const [searchRestrctState, setSearchRestrictState] = useState<
    ReadonlySet<string>
  >(AllSearchRestrictKeys);

  const handleSearch: SubmitHandler<SearchForm> = useCallback(
    (formData) => {
      let filter: Maybe<SearchFilter>;
      if (formData.filter.type === 'text') {
        const parsedFilter = getSearchExpression(formData.filter.expression);
        parsedFilter?.errors?.forEach((err) => console.error(err));
        filter =
          parsedFilter?.type === 'success'
            ? tunarrSearch.parsedSearchToRequest(parsedFilter.query)
            : undefined;
      } else {
        filter = formData.filter.filter;
      }
      const search: SearchRequest = {
        query: isNonEmptyString(formData.keywords)
          ? formData.keywords
          : undefined,
        filter,
        restrictSearchTo:
          isEmpty(searchRestrctState) ||
          difference([...AllSearchRestrictKeys], [...searchRestrctState])
            .length === 0
            ? undefined
            : [...searchRestrctState],
      };
      // // If we successfully parsed the search query, it's structured. Otherwise
      // // we just treat it as a raw query.
      const currentParams = new URLSearchParams(window.location.search);
      // if (isNonEmptyString(query)) {
      //   currentParams.set('query', query);
      // } else {
      //   currentParams.delete('query');
      // }

      if (last(routeMatch)?.pathname.startsWith('/search')) {
        window.history.replaceState(
          {},
          '',
          `${window.location.pathname}?${currentParams.toString()}`,
        );
      }

      // if (expr && expr.type === 'success') {
      //   search.query = null;
      //   search.filter = tunarrSearch.parsedSearchToRequest(expr.query);
      // } else {
      //   expr?.errors.forEach((err) => console.error(err));
      // }
      setSearchRequest(search);
    },
    [getSearchExpression, routeMatch, searchRestrctState],
  );

  return (
    <Box
      component="form"
      onSubmit={formMethods.handleSubmit(handleSearch, console.error)}
    >
      <FormProvider {...formMethods}>
        <Stack gap={2}>
          <Controller
            control={formMethods.control}
            name="keywords"
            render={({ field }) => (
              <TextField
                label="Keywords"
                fullWidth
                {...field}
                slotProps={{
                  input: {
                    spellCheck: false,
                    endAdornment: (
                      <>
                        {isNonEmptyString(keywordSearch) && (
                          <InputAdornment position="end">
                            <IconButton onClick={() => setKeywordSearch('')}>
                              <Clear />
                            </IconButton>
                          </InputAdornment>
                        )}
                        <InputAdornment position="end">
                          <Tooltip title="Restrict search fields">
                            <IconButton
                              onClick={(e) =>
                                setSearchRestrictEl(e.currentTarget)
                              }
                            >
                              <FilterList />
                            </IconButton>
                          </Tooltip>
                          <SearchFieldRestrictMenu
                            anchor={searchRestrictEl}
                            onClose={() => setSearchRestrictEl(null)}
                            searchFields={searchRestrctState}
                            onSearchFieldsChanged={setSearchRestrictState}
                            // mediaType={mediaTypeFilter}
                          />
                        </InputAdornment>
                        <InputAdornment position="end">
                          <Tooltip
                            title="Keywords perform full text search across all (or configured) fields"
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
                            <Help />
                          </Tooltip>
                        </InputAdornment>
                      </>
                    ),
                  },
                }}
              />
            )}
          />
          <SearchFilterBuilder
            onSearch={handleSearchChange}
            initialQuery={initialSearchQuery}
            mediaTypeFilter={
              props.mediaSource?.type === 'local'
                ? props.mediaSource.mediaType
                : props.library?.mediaType
            }
          />
          <Box sx={{ width: '100%' }}>
            <Stack direction={'row'} justifyContent={'flex-end'}>
              <Tooltip title="Save as Smart Collection">
                <IconButton
                  type="submit"
                  // onClick={() => toggleSmartCollectionModal(true)}
                >
                  <Save />
                </IconButton>
              </Tooltip>
              <IconButton type="submit">
                <Search />
              </IconButton>
            </Stack>
          </Box>
        </Stack>
      </FormProvider>
    </Box>
  );
};
