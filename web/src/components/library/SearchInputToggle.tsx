import { Keyboard, Mouse } from '@mui/icons-material';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import { useCallback } from 'react';
import type { Nullable } from '../../types/util.ts';
import type { QueryBuilderType } from '../search/SearchFilterBuilder.tsx';

type Props = {
  onQueryBuilderTypeChange: (type: QueryBuilderType) => void;
  queryBuilderType: QueryBuilderType;
};

export const SearchInputToggle = ({
  onQueryBuilderTypeChange,
  queryBuilderType,
}: Props) => {
  const onTypeChange = useCallback(
    (v: Nullable<QueryBuilderType>) => {
      if (!v) {
        return;
      }
      onQueryBuilderTypeChange(v);
    },
    [onQueryBuilderTypeChange],
  );

  return (
    <ToggleButtonGroup
      value={queryBuilderType}
      onChange={(_, v) => {
        onTypeChange(v as Nullable<QueryBuilderType>);
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
