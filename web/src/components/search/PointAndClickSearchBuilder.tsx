import { Stack, TextField } from '@mui/material';
import type { MediaSourceId } from '@tunarr/shared';
import { search } from '@tunarr/shared/util';
import { FormProvider, useFormContext } from 'react-hook-form';
import { SearchGroupNode } from './SearchGroupNode.tsx';
import type { SearchForm } from './SearchInput.tsx';
import { SearchInputToggle } from './SearchInputToggle.tsx';

type Props = {
  mediaSourceId?: MediaSourceId;
  libraryId?: string;
};

export const PointAndClickSearchBuilder = ({
  mediaSourceId,
  libraryId,
}: Props) => {
  const form = useFormContext<SearchForm>();
  const filter = form.watch('filter');
  console.log(filter);

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
              ? search.searchFilterToString(
                  search.normalizeSearchFilter(filter.filter),
                )
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
        mediaSourceId={mediaSourceId}
        libraryId={libraryId}
      />
    </FormProvider>
  );
};
