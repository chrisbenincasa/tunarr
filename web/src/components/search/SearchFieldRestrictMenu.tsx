import { Checkbox, FormControlLabel, Menu, MenuItem } from '@mui/material';
import type { MediaSourceContentType } from '@tunarr/types';
import { reject } from 'lodash-es';
import { useMemo } from 'react';
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
  key: string;
  name: string;
  libraryTypes: 'all' | MediaSourceContentType[];
  selectedDefault: boolean;
};

const SearchRestrictOptions: SearchRestrictOption[] = [
  {
    key: 'title',
    name: 'Title',
    libraryTypes: ['movies', 'music_videos', 'other_videos'],
    selectedDefault: true,
  },
  {
    key: 'title',
    name: 'Show Title',
    libraryTypes: ['shows'],
    selectedDefault: true,
  },
  {
    key: 'plot',
    name: 'Summary',
    libraryTypes: 'all',
    selectedDefault: false,
  },
];

export type SearchRestrictKeys = (typeof SearchRestrictOptions)[number]['key'];

export const AllSearchRestrictKeys = new Set(
  SearchRestrictOptions.map((opt) => opt.key),
) as ReadonlySet<SearchRestrictKeys>;

export const SearchFieldRestrictMenu = ({
  anchor,
  onClose,
  searchFields,
  onSearchFieldsChanged,
  mediaType: libraryType,
}: Props) => {
  const searchRestrictOptions = useMemo(() => {
    return SearchRestrictOptions.filter(
      (opt) =>
        opt.libraryTypes === 'all' ||
        (libraryType && opt.libraryTypes.includes(libraryType)),
    );
  }, [libraryType]);

  const searchRestrictOptionKeys = useMemo(
    () => new Set(searchRestrictOptions.map((opt) => opt.key)),
    [searchRestrictOptions],
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
      {searchRestrictOptions.map(({ key, name, selectedDefault }) => (
        <MenuItem dense disableRipple disableTouchRipple key={key}>
          <FormControlLabel
            label={name}
            defaultChecked={selectedDefault}
            checked={searchFields.has(key)}
            onChange={(_, checked) => handleSetSearchRestrict(key, checked)}
            control={<Checkbox size="small" />}
          />
        </MenuItem>
      ))}
    </Menu>
  );
};
