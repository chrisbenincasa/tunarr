import { Autocomplete, TextField } from '@mui/material';
import type { FillerList } from '@tunarr/types';
import { find, some } from 'lodash-es';
import { useMemo, useState } from 'react';
import { useFillerLists } from '../../hooks/useFillerLists.ts';

type Props = {
  selectedId: string;
  onChange: (list: FillerList) => void;
  filterOptions: (lists: FillerList[]) => FillerList[];
};

export const FillerListAutocomplete = ({
  selectedId,
  onChange,
  filterOptions,
}: Props) => {
  const { data: fillerLists } = useFillerLists();

  const [chosenFillerLists, setChosenFillerLists] = useState<string[]>([]);

  const fillerListOptions = useMemo(() => {
    if (chosenFillerLists.length <= 1) {
      return fillerLists;
    }

    return fillerLists.filter(
      (list) => !some(chosenFillerLists, (field) => field === list.id),
    );
  }, [chosenFillerLists, fillerLists]);

  return (
    <Autocomplete
      fullWidth
      disableClearable={true}
      options={fillerLists}
      filterOptions={filterOptions}
      getOptionKey={(list) => list.id}
      getOptionLabel={(list) => list.name}
      value={find(fillerLists, { id: selectedId })}
      onChange={(_, list) => onChange(list)}
      renderInput={(params) => <TextField {...params} label="Filler List" />}
      sx={{ flex: 1 }}
    />
  );
};
