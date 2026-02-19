import { TextField } from '@mui/material';
import { Controller, useFormContext } from 'react-hook-form';
import type { SearchFieldSpec } from '../../helpers/searchBuilderConstants.ts';
import type { FieldKey, FieldPrefix } from '../../types/SearchBuilder.ts';
import type { SearchForm } from './SearchInput.tsx';

type Props = {
  field: SearchFieldSpec<'string'>;
  formKey: FieldKey<FieldPrefix, 'fieldSpec'>;
};

export const StringValueSearchNode = ({ formKey }: Props) => {
  const { control } = useFormContext<SearchForm>();

  return (
    <Controller
      control={control}
      name={`${formKey}.value`}
      render={({ field }) => {
        return (
          <TextField
            label="Value"
            size="small"
            {...field}
            onChange={(e) => field.onChange([e.target.value])}
          />
        );
      }}
    />
  );
};
