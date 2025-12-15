import { Checklist, Clear, Save, Search } from '@mui/icons-material';
import {
  Alert,
  Box,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
} from '@mui/material';
import { useMatches } from '@tanstack/react-router';
import { search as tunarrSearch } from '@tunarr/shared/util';
import type { MediaSourceContentType } from '@tunarr/types';
import type { SearchRequest } from '@tunarr/types/api';
import { useToggle } from '@uidotdev/usehooks';
import { isEmpty, last } from 'lodash-es';
import { useCallback, useMemo, useState } from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { difference, isNonEmptyString } from '../../helpers/util.ts';
import { useSearchQueryParser } from '../../hooks/useSearchQueryParser.ts';
import { Route } from '../../routes/__root.tsx';
import type { Nullable } from '../../types/util.ts';
import { CreateSmartCollectionDialog } from '../smart_collections/CreateSmartCollectionDialog.tsx';
import {
  AllSearchRestrictKeys,
  SearchFieldRestrictMenu,
} from './SearchFieldRestrictMenu.tsx';

type SearchBuilderProps = {
  onSearch: (query: SearchRequest) => void;
  initialQuery?: string;
  // If we're focused on a specific media / library, filter available
  // field options
  mediaTypeFilter?: MediaSourceContentType;
};

export function SearchBuilder({
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

  const formMethods = useForm<SearchRequest>({
    defaultValues: {
      query: initialQuery ?? '',
      filter: null,
      sort: null,
    },
  });

  const { getSearchExpression } = useSearchQueryParser();
  const [query] = formMethods.watch(['query']);

  const expr = useMemo(() => {
    if (isNonEmptyString(query)) {
      console.log(query);
      const result = getSearchExpression(query);
      const isStructured = result?.type === 'success';
      setIsStructuredSearch(isStructured);
      return result;
    }
    setIsStructuredSearch(false);
    return;
  }, [query, getSearchExpression]);

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

  return (
    <FormProvider {...formMethods}>
      <Box
        component="form"
        onSubmit={formMethods.handleSubmit(handleSearch, console.error)}
      >
        <Stack gap={2}>
          <Controller
            name="query"
            control={formMethods.control}
            render={({ field }) => (
              <TextField
                label="Search"
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
                          <Tooltip title="Restrict search fields">
                            <IconButton
                              onClick={(e) =>
                                setSearchRestrictEl(e.currentTarget)
                              }
                            >
                              <Checklist />
                            </IconButton>
                          </Tooltip>
                          <SearchFieldRestrictMenu
                            anchor={searchRestrictEl}
                            onClose={() => setSearchRestrictEl(null)}
                            searchFields={searchRestrctState}
                            onSearchFieldsChanged={setSearchRestrictState}
                            mediaType={mediaTypeFilter}
                          />
                        </InputAdornment>
                        <InputAdornment position="end">
                          <Tooltip title="Save as Smart Collection">
                            <IconButton
                              onClick={() => toggleSmartCollectionModal(true)}
                            >
                              <Save />
                            </IconButton>
                          </Tooltip>
                        </InputAdornment>
                        <InputAdornment position="end">
                          <IconButton type="submit">
                            <Search />
                          </IconButton>
                        </InputAdornment>
                      </>
                    ),
                  },
                }}
                fullWidth
                {...field}
              />
            )}
          />
          {!isStructuredSearch && isNonEmptyString(query) && (
            <Alert severity="info">
              Tunarr is interpretting this query as a "free text" query. This
              means the query is taken verbatim and searched across all fields.
              If you are intending to use a "structured" query (e.g. &nbsp;
              <code>title:"ABC"</code>) and are seeing this message, there is a
              syntax error or unsupported field in your query.
            </Alert>
          )}
        </Stack>
      </Box>
      <CreateSmartCollectionDialog
        open={smartCollectionModalOpen}
        onClose={() => toggleSmartCollectionModal(false)}
        initialQuery={query}
      />
    </FormProvider>
  );
}
