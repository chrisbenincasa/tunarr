import { Stack, TextField } from '@mui/material';
import type { MediaSourceLibrary } from '@tunarr/types';
import { FormProvider, useFormContext } from 'react-hook-form';
import { searchFilterToString } from '../../../../shared/dist/src/util/searchUtil';
import { SearchGroupNode } from './SearchGroupNode.tsx';
import type { SearchForm } from './SearchInput.tsx';
import { SearchInputToggle } from './SearchInputToggle.tsx';

type Props = {
  library?: MediaSourceLibrary;
};

export const PointAndClickSearchBuilder = ({ library }: Props) => {
  const form = useFormContext<SearchForm>();
  const filter = form.watch('filter');

  return (
    <FormProvider {...form}>
      <Stack direction="row" gap={2} alignItems={'center'}>
        <TextField
          label="Filter"
          disabled
          size="small"
          fullWidth
          value={
            filter.type === 'structured'
              ? searchFilterToString(filter.filter)
              : ''
          }
        />
        <SearchInputToggle />
      </Stack>

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
