import { Checklist, Clear, Search } from '@mui/icons-material';
import {
  Box,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
} from '@mui/material';
import { useMatches } from '@tanstack/react-router';
import { search as tunarrSearch } from '@tunarr/shared/util';
import type { SearchRequest } from '@tunarr/types/api';
import { isEmpty, last } from 'lodash-es';
import { useCallback, useMemo, useState } from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { difference, isNonEmptyString } from '../../helpers/util.ts';
import { useSearchQueryParser } from '../../hooks/useSearchQueryParser.ts';
import { Route } from '../../routes/__root.tsx';
import type { Nullable } from '../../types/util.ts';
import {
  AllSearchRestrictKeys,
  SearchFieldRestrictMenu,
} from './SearchFieldRestrictMenu.tsx';

type SearchBuilderProps = {
  // mediaSource?: MediaSourceSettings;
  // library?: MediaSourceLibrary;
  onSearch: (query: SearchRequest) => void;
  initialQuery?: string;
};

export function SearchBuilder({
  // mediaSource,
  // library,
  onSearch,
  initialQuery,
}: SearchBuilderProps) {
  const navigate = Route.useNavigate();
  const routeMatch = useMatches();
  const [searchRestrictEl, setSearchRestrictEl] =
    useState<Nullable<HTMLElement>>(null);
  const [searchRestrctState, setSearchRestrictState] = useState<
    ReadonlySet<string>
  >(AllSearchRestrictKeys);

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
      return getSearchExpression(query);
    }
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

  // const handleSearchFilterTypeChange = useCallback(
  //   (
  //     newType: 'basic' | 'advanced' | 'none',
  //     originalOnChange: (...args: unknown[]) => void,
  //   ) => {
  //     const newValue = match([filter, newType])
  //       .returnType<SearchFilter | null>()
  //       .with([P._, 'none'], () => null)
  //       .with([P._, 'basic'], () => defaultValueNode)
  //       .with([P._, 'advanced'], ([currentFilter, _]) => ({
  //         op: 'and',
  //         type: 'op',
  //         children: [currentFilter ?? defaultValueNode],
  //       }))
  //       .exhaustive();

  //     originalOnChange(newValue);
  //   },
  //   [filter],
  // );

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
                            // libraryType={
                            //   mediaSource?.type === 'local'
                            //     ? mediaSource.mediaType
                            //     : library?.mediaType
                            // }
                          />
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
          {/* <Box>
            <FormLabel>Filter: </FormLabel>
            <Controller
              control={formMethods.control}
              name="filter"
              render={({ field }) => {
                return (
                  <ToggleButtonGroup
                    size="small"
                    color="primary"
                    exclusive
                    value={
                      !field.value
                        ? 'none'
                        : field.value.type === 'value'
                          ? 'basic'
                          : 'advanced'
                    }
                    onChange={(_, value) =>
                      value
                        ? handleSearchFilterTypeChange(
                            value as 'basic' | 'advanced' | 'none',
                            field.onChange,
                          )
                        : void 0
                    }
                  >
                    <ToggleButton value="none">None</ToggleButton>
                    <ToggleButton value="basic">Basic</ToggleButton>
                    <ToggleButton value="advanced">Advanced</ToggleButton>
                  </ToggleButtonGroup>
                );
              }}
            />
          </Box> */}
          {/* <Box>
            <Stack gap={2} useFlexGap>
              {renderFilters()}
            </Stack>
          </Box> */}
        </Stack>
      </Box>
    </FormProvider>
  );
}
