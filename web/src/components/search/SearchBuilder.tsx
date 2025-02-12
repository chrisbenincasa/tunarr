import { Checklist, Search } from '@mui/icons-material';
import {
  Box,
  FormLabel,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from '@mui/material';
import { search as tunarrSearch } from '@tunarr/shared/util';
import type { MediaSourceLibrary } from '@tunarr/types';
import type { SearchFilterValueNode, SearchRequest } from '@tunarr/types/api';
import { type SearchFilter } from '@tunarr/types/api';
import { useDebounce } from '@uidotdev/usehooks';
import { isEmpty } from 'lodash-es';
import { useCallback, useMemo, useState } from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { match, P } from 'ts-pattern';
import { difference, isNonEmptyString } from '../../helpers/util.ts';
import { useSearchQueryParser } from '../../hooks/useSearchQueryParser.ts';
import type { Nullable } from '../../types/util.ts';
import {
  AllSearchRestrictKeys,
  SearchFieldRestrictMenu,
} from './SearchFieldRestrictMenu.tsx';
import { SearchGroupNode } from './SearchGroupNode.tsx';
import { SearchValueNode } from './SearchValueNode.tsx';

type SearchBuilderProps = {
  library: MediaSourceLibrary;
  onSearch: (query: SearchRequest) => void;
};

const defaultValueNode: SearchFilterValueNode = {
  type: 'value',
  fieldSpec: {
    key: 'title',
    name: 'Title',
    type: 'string',
    op: '=',
    value: [],
  },
};

export function SearchBuilder({ library, onSearch }: SearchBuilderProps) {
  const [searchRestrictEl, setSearchRestrictEl] =
    useState<Nullable<HTMLElement>>(null);
  const [searchRestrctState, setSearchRestrictState] = useState<
    ReadonlySet<string>
  >(AllSearchRestrictKeys);
  const formMethods = useForm<SearchRequest>({
    defaultValues: {
      query: '',
      filter: null,
      sort: null,
    },
  });

  const { getSearchExpression } = useSearchQueryParser();
  const [filter, query] = formMethods.watch(['filter', 'query']);
  const debouncedQuery = useDebounce(query, 250);

  const expr = useMemo(() => {
    if (isNonEmptyString(query)) {
      return getSearchExpression(query);
    }
    return;
  }, [query, getSearchExpression]);

  const handleSearch: SubmitHandler<SearchRequest> = (data) => {
    const search: SearchRequest = data;
    console.log(expr);
    if (expr && expr.type === 'success') {
      search.query = null;
      search.filter = tunarrSearch.parsedSearchToRequest(expr.query);
    }
    console.log(search);
    onSearch({
      ...search,
      restrictSeachTo:
        isEmpty(searchRestrctState) ||
        difference(AllSearchRestrictKeys, searchRestrctState).size === 0
          ? undefined
          : [...searchRestrctState],
    });
  };

  const handleSearchFilterTypeChange = useCallback(
    (
      newType: 'basic' | 'advanced' | 'none',
      originalOnChange: (...args: unknown[]) => void,
    ) => {
      const newValue = match([filter, newType])
        .returnType<SearchFilter | null>()
        .with([P._, 'none'], () => null)
        .with([P._, 'basic'], () => defaultValueNode)
        .with([P._, 'advanced'], ([currentFilter, _]) => ({
          op: 'and',
          type: 'op',
          children: [currentFilter ?? defaultValueNode],
        }))
        .exhaustive();

      originalOnChange(newValue);
    },
    [filter],
  );

  const renderFilters = () => {
    if (!filter) {
      return null;
    }

    if (filter.type === 'op') {
      return (
        <SearchGroupNode
          depth={0}
          formKey="filter"
          index={0}
          remove={() => {}}
          library={library}
        />
      );
    } else {
      return (
        <SearchValueNode
          only
          depth={0}
          formKey="filter"
          index={0}
          remove={() => {}}
          library={library}
        />
      );
    }
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
                placeholder="Search"
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <>
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
                            libraryType={library.mediaType}
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
          <Box>
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
          </Box>
          <Box>
            <Stack gap={2} useFlexGap>
              {renderFilters()}
            </Stack>
          </Box>
        </Stack>
      </Box>
    </FormProvider>
  );
}
