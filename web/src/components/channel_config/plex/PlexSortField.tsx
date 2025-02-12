import { useCurrentMediaSourceView } from '@/store/programmingSelector/selectors.ts';
import ArrowDownward from '@mui/icons-material/ArrowDownward';
import ArrowUpward from '@mui/icons-material/ArrowUpward';
import { FormControl, FormGroup, IconButton, InputLabel } from '@mui/material';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import { first, isEmpty } from 'lodash-es';
import find from 'lodash-es/find';
import isUndefined from 'lodash-es/isUndefined';
import map from 'lodash-es/map';
import { useCallback, useEffect, useState } from 'react';
import { useSelectedLibraryPlexFilters } from '../../../hooks/plex/usePlexFilters';
import { setPlexSort } from '../../../store/programmingSelector/actions';

type PlexSort = {
  key: string;
  title: string;
  ascending: boolean;
};

export function PlexSortField() {
  const selectedLibrary = useCurrentMediaSourceView('plex');

  const [sort, setSort] = useState<PlexSort>({
    key: 'titleSort',
    title: 'Title',
    ascending: true,
  });

  const { data: plexFilterMetadata, isLoading: filterMetadataLoading } =
    useSelectedLibraryPlexFilters();

  const libraryFilterMetadata = find(
    plexFilterMetadata?.Type,
    (t) =>
      selectedLibrary?.view.type === 'library' &&
      t.type === selectedLibrary?.view.library.childType,
  );

  useEffect(() => {
    if (isEmpty(sort.key) && !isUndefined(libraryFilterMetadata)) {
      const defaultSort =
        find(libraryFilterMetadata?.Sort ?? [], (s) => !!s.active) ??
        first(libraryFilterMetadata.Sort);
      if (defaultSort) {
        setSort({
          key: defaultSort.key,
          title: defaultSort.title,
          ascending: defaultSort.defaultDirection === 'asc',
        });
      }
    }
  }, [libraryFilterMetadata, sort, setSort]);

  useEffect(() => {
    const plexSort = find(libraryFilterMetadata?.Sort, { key: sort.key });
    if (!isUndefined(plexSort)) {
      setPlexSort({
        field: sort.key,
        direction: sort.ascending ? 'asc' : 'desc',
      });
    }
  }, [sort, libraryFilterMetadata]);

  const handleSortKeyChange = useCallback(
    (newSortKey: string) => {
      const plexSort = find(libraryFilterMetadata?.Sort, { key: newSortKey });
      if (!isUndefined(plexSort)) {
        setSort((prev) => ({
          key: newSortKey,
          ascending:
            prev.ascending && plexSort.defaultDirection !== 'asc'
              ? false
              : true,
          title: plexSort.title,
        }));
      }
    },
    [setSort, libraryFilterMetadata],
  );

  return (
    !filterMetadataLoading &&
    !isUndefined(libraryFilterMetadata?.Sort) && (
      <FormGroup row>
        <FormControl>
          <InputLabel>Sort</InputLabel>
          <Select
            value={sort.key ?? ''}
            label="Sort"
            size="small"
            onChange={(e) => handleSortKeyChange(e.target.value)}
          >
            {map(libraryFilterMetadata.Sort, (sort) => (
              <MenuItem key={sort.key} value={sort.key}>
                {sort.title}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <IconButton
          disableRipple
          onClick={() =>
            setSort((prev) => ({ ...prev, ascending: !prev.ascending }))
          }
        >
          {sort.ascending ? <ArrowUpward /> : <ArrowDownward />}
        </IconButton>
      </FormGroup>
    )
  );
}
