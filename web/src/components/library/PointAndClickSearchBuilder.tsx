import { TextField } from '@mui/material';
import type { MediaSourceLibrary } from '@tunarr/types';
import { FormProvider, useFormContext } from 'react-hook-form';
import { searchFilterToString } from '../../../../shared/dist/src/util/searchUtil';
import { SearchGroupNode } from '../search/SearchGroupNode.tsx';
import type { SearchForm } from './SearchInput.tsx';

type Props = {
  library?: MediaSourceLibrary;
};

export const PointAndClickSearchBuilder = ({ library }: Props) => {
  const form = useFormContext<SearchForm>();
  const filter = form.watch('filter');

  return (
    <FormProvider {...form}>
      <TextField
        label="Filter"
        disabled
        size="small"
        value={
          filter.type === 'structured'
            ? searchFilterToString(filter.filter)
            : ''
        }
      />

      <SearchGroupNode
        depth={0}
        formKey="filter.filter"
        index={0}
        remove={() => {}}
        library={library}
      />
    </FormProvider>
  );
};
