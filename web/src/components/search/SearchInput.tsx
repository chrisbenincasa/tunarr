import { Clear, FilterList, Help, Save, Search } from '@mui/icons-material';
import {
  Box,
  Dialog,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
} from '@mui/material';
import type { MediaSourceId } from '@tunarr/shared';
import { isNonEmptyString, search as tunarrSearch } from '@tunarr/shared/util';
import type { SearchFilter, SearchRequest } from '@tunarr/types/schemas';
import { useToggle } from '@uidotdev/usehooks';
import { difference, isEmpty, isEqual } from 'lodash-es';
import { useCallback, useEffect, useState } from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { normalizeSearchFilter } from '../../../../shared/dist/src/util/searchUtil';
import { useSearchQueryParser } from '../../hooks/useSearchQueryParser.ts';
import { setSearchRequest } from '../../store/programmingSelector/actions.ts';
import type { Maybe, Nullable } from '../../types/util.ts';
import { ProgramViewToggleButton } from '../base/ProgramViewToggleButton.tsx';
import { CreateSmartCollectionDialog } from '../smart_collections/CreateSmartCollectionDialog.tsx';
import {
  AllSearchRestrictKeys,
  SearchFieldRestrictMenu,
} from './SearchFieldRestrictMenu.tsx';
import { SearchFilterBuilder } from './SearchFilterBuilder.tsx';

type Props = {
  mediaSourceId?: MediaSourceId;
  libraryId?: string;
  initialKeywords?: string;
  initialSearchFilter?: SearchFilter;
  showViewToggle?: boolean;
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

export type QueryBuilderType = 'text' | 'click';

export type SearchForm = {
  keywords: string;
  filter: SearchFilterFormInput;
  queryBuilderType: QueryBuilderType;
};

function searchFormDefaultValues(
  initialSearchFilter?: SearchFilter,
  initialKeywords?: string,
): SearchForm {
  return {
    filter: {
      type: 'text',
      expression: initialSearchFilter
        ? tunarrSearch.searchFilterToString(initialSearchFilter)
        : '',
    },
    keywords: initialKeywords ?? '',
    queryBuilderType: 'text',
  };
}

export const SearchInput = ({
  libraryId,
  initialKeywords,
  initialSearchFilter,
  mediaSourceId,
  showViewToggle,
}: Props) => {
  const [savedInitialSearch, setInitialSearch] = useState(initialSearchFilter);
  const [savedKeywords, setKeywords] = useState(initialKeywords);
  const formMethods = useForm<SearchForm>({
    defaultValues: searchFormDefaultValues(
      initialSearchFilter,
      initialKeywords,
    ),
    mode: 'onChange',
  });

  const formState = formMethods.formState;

  // eslint-disable-next-line react-hooks/incompatible-library
  const searchForm = formMethods.watch();
  const query = searchForm.filter;

  // Some insane stuff we have to do to get reasonable UX with react-hook-form
  useEffect(() => {
    if (
      !isEqual(initialSearchFilter, savedInitialSearch) ||
      initialKeywords !== savedKeywords
    ) {
      setInitialSearch(initialSearchFilter);
      setKeywords(initialKeywords);
      formMethods.reset(
        searchFormDefaultValues(initialSearchFilter, initialKeywords),
      );
    }
  }, [
    formMethods,
    initialKeywords,
    initialSearchFilter,
    query,
    savedInitialSearch,
    savedKeywords,
  ]);

  const [smartCollectionModalOpen, toggleSmartCollectionModal] =
    useToggle(false);

  const { getSearchExpression, parseToSearchFilterOrNull } =
    useSearchQueryParser();

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

      if (filter) {
        console.log(filter);
        filter = normalizeSearchFilter(filter);
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
      // const currentParams = new URLSearchParams(window.location.search);

      // if (last(routeMatch)?.pathname.startsWith('/search')) {
      //   window.history.replaceState(
      //     {},
      //     '',
      //     `${window.location.pathname}?${currentParams.toString()}`,
      //   );
      // }

      setSearchRequest(search);
    },
    [getSearchExpression, searchRestrctState],
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
            libraryId={libraryId}
            mediaSourceId={mediaSourceId}
            onSearch={handleSearchChange}
          />
          <Box sx={{ width: '100%' }}>
            <Stack direction={'row'}>
              {showViewToggle && <ProgramViewToggleButton />}
              <Box sx={{ marginLeft: 'auto' }}>
                <Tooltip title="Save as Smart Collection">
                  <IconButton
                    onClick={() => toggleSmartCollectionModal(true)}
                    disabled={!!formState.errors.filter}
                  >
                    <Save />
                  </IconButton>
                </Tooltip>
                <IconButton type="submit">
                  <Search />
                </IconButton>
              </Box>
            </Stack>
          </Box>
        </Stack>
      </FormProvider>
      <Dialog
        fullWidth
        open={smartCollectionModalOpen}
        onClose={() => toggleSmartCollectionModal(false)}
      >
        <CreateSmartCollectionDialog
          onClose={() => toggleSmartCollectionModal(false)}
          initialQuery={{
            filter:
              searchForm.filter.type === 'structured'
                ? searchForm.filter.filter
                : (parseToSearchFilterOrNull(searchForm.filter.expression) ??
                  undefined),
          }}
        />
      </Dialog>
    </Box>
  );
};
