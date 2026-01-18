import {
  Checkbox,
  FormControlLabel,
  ListItemText,
  Menu,
  MenuItem,
} from '@mui/material';
import type { MediaSourceContentType } from '@tunarr/types';
import { reject } from 'lodash-es';
import { useMemo } from 'react';
import type { NonEmptyArray } from 'ts-essentials';
import { difference } from '../../helpers/util.ts';
import type { Nullable } from '../../types/util.ts';

type Props = {
  anchor: Nullable<HTMLElement>;
  onClose: () => void;
  searchFields: ReadonlySet<SearchRestrictKeys>;
  onSearchFieldsChanged: (newFields: ReadonlySet<SearchRestrictKeys>) => void;
  mediaType?: MediaSourceContentType;
};

type SearchRestrictOption = {
  keys: NonEmptyArray<string>;
  name: string;
  // libraryTypes: 'all' | MediaSourceContentType[];
  selectedDefault: boolean;
};

const SearchRestrictOptions = [
  {
    keys: ['title'],
    name: 'Title',
    // libraryTypes: ['movies', 'music_videos', 'other_videos'],
    selectedDefault: true,
  },
  {
    keys: ['show.title'],
    name: 'Show Title',
    selectedDefault: true,
  },
  {
    keys: ['plot'],
    name: 'Summary',
    // libraryTypes: 'all',
    selectedDefault: false,
  },
  {
    keys: ['tagline'],
    name: 'Tagline',
    selectedDefault: true,
  },
] as const satisfies SearchRestrictOption[];

export type SearchRestrictKeys =
  (typeof SearchRestrictOptions)[number]['keys'][number];

export const AllSearchRestrictKeys = new Set(
  SearchRestrictOptions.flatMap((opt) => opt.keys),
) as ReadonlySet<SearchRestrictKeys>;

export const DefaultSearchRestrictKeys = new Set<SearchRestrictKeys>(['plot']);

export const SearchFieldRestrictMenu = ({
  anchor,
  onClose,
  searchFields,
  onSearchFieldsChanged,
  mediaType: libraryType,
}: Props) => {
  // const searchRestrictOptions = useMemo(() => {
  //   return SearchRestrictOptions.filter(
  //     (opt) =>
  //       opt.libraryTypes === 'all' ||
  //       (libraryType && opt.libraryTypes.includes(libraryType)),
  //   );
  // }, [libraryType]);

  const searchRestrictOptionKeys = useMemo(
    () => new Set(SearchRestrictOptions.flatMap((opt) => opt.keys)),
    [],
  );

  const handleSetSearchRestrict = (
    key: SearchRestrictKeys,
    checked: boolean,
  ) => {
    const newFields = checked
      ? new Set([...searchFields.values(), key])
      : new Set(reject([...searchFields.values()], (v) => v === key));
    onSearchFieldsChanged(newFields);
  };

  return (
    <Menu
      anchorEl={anchor}
      open={Boolean(anchor)}
      onClose={() => onClose()}
      slotProps={{
        list: {
          dense: true,
        },
      }}
    >
      <MenuItem
        disabled={searchFields.size === 0}
        onClick={() => onSearchFieldsChanged(new Set())}
      >
        Clear
      </MenuItem>
      <MenuItem
        disabled={difference(searchRestrictOptionKeys, searchFields).size === 0}
        onClick={() =>
          onSearchFieldsChanged(new Set([...searchRestrictOptionKeys]))
        }
      >
        Select All
      </MenuItem>
      {SearchRestrictOptions.flatMap(({ keys, name, selectedDefault }) =>
        keys.map((key) => (
          <MenuItem dense disableRipple disableTouchRipple key={key}>
            <FormControlLabel
              label={<ListItemText>{name}</ListItemText>}
              defaultChecked={selectedDefault}
              checked={searchFields.has(key)}
              onChange={(_, checked) => handleSetSearchRestrict(key, checked)}
              control={<Checkbox sx={{ py: 0 }} size="small" />}
            />
          </MenuItem>
        )),
      )}
    </Menu>
  );
};
