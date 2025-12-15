import { TextField } from '@mui/material';
import type { MediaSourceLibrary } from '@tunarr/types';
import type { SearchRequest } from '@tunarr/types/api';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { searchFilterToString } from '../../../../shared/dist/src/util/searchUtil';
import { SearchGroupNode } from '../search/SearchGroupNode.tsx';

type Props = {
  library?: MediaSourceLibrary;
};

export const PointAndClickSearchBuilder = ({ library }: Props) => {
  const form = useForm<SearchRequest>({
    defaultValues: {
      query: null,
      filter: {
        type: 'op',
        children: [],
        op: 'and',
      },
    } satisfies SearchRequest,
  });
  const [filter] = form.watch(['filter']);
  console.log(filter);
  return (
    <FormProvider {...form}>
      <Controller
        control={form.control}
        name="filter"
        render={({ field }) => {
          console.log(field.value);
          return (
            <TextField
              label="Search"
              {...field}
              disabled
              value={field.value ? searchFilterToString(field.value) : ''}
            />
          );
        }}
      />
      <SearchGroupNode
        depth={0}
        formKey="filter"
        index={0}
        remove={() => {}}
        library={library}
      />
    </FormProvider>
  );
};
