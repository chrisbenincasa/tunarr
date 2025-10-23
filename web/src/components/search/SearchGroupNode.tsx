import type { FieldPrefix } from '@/types/SearchBuilder.ts';
import Add from '@mui/icons-material/Add';
import Delete from '@mui/icons-material/Delete';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import {
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tooltip,
} from '@mui/material';
import type { MediaSourceLibrary } from '@tunarr/types';
import type { SearchFilter } from '@tunarr/types/api';
import { map } from 'lodash-es';
import { Controller, useFieldArray, useFormContext } from 'react-hook-form';
import { SearchFieldSpec } from '../../helpers/searchBuilderConstants.ts';
import { useGetFieldName } from '../../hooks/searchBuilderHooks.ts';
import { SearchValueNode } from './SearchValueNode.tsx';

export type GroupNodeProps = {
  library?: MediaSourceLibrary;
  index: number;
  depth: number;
  formKey: FieldPrefix;
  remove: (index: number) => void;
};

export function SearchGroupNode({
  depth,
  formKey,
  remove: removeSelf,
  index,
  library,
}: GroupNodeProps) {
  const { control } = useFormContext();
  const prefix = `${formKey}.` as const;
  const getFieldName = useGetFieldName(formKey);

  const {
    fields,
    append,
    remove: removeChild,
  } = useFieldArray<SearchFilter>({
    // Hack to get react-hook-form to work with recurisve data structures
    // References:
    //  * https://github.com/react-hook-form/react-hook-form/issues/4055
    //  * https://github.com/orgs/react-hook-form/discussions/7433
    name: `${prefix}children` as 'children',
  });

  return (
    <Stack direction="column" gap={2}>
      <Stack
        direction="row"
        sx={{
          pl: 4 * depth,
          alignItems: 'center',
        }}
      >
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Field</InputLabel>
          <Controller
            control={control}
            name={getFieldName('op')}
            render={({ field }) => (
              <Select
                label="Field"
                MenuProps={{ sx: { maxHeight: 375 } }}
                {...field}
              >
                <MenuItem value="and">Match all of</MenuItem>
                <MenuItem value="or">Match any of</MenuItem>
              </Select>
            )}
          />
        </FormControl>
        <Tooltip title="Add field">
          <IconButton
            onClick={() =>
              append({
                type: 'value',
                fieldSpec: {
                  ...SearchFieldSpec['title'],
                  op: '=',
                  value: [''],
                },
              })
            }
          >
            <Add />
          </IconButton>
        </Tooltip>
        <Tooltip title="Add group">
          <IconButton
            onClick={() => append({ type: 'op', children: [], op: 'and' })}
          >
            <PlaylistAddIcon />
          </IconButton>
        </Tooltip>
        {depth > 0 && (
          <span>
            <IconButton onClick={() => removeSelf(index)}>
              <Delete />
            </IconButton>
          </span>
        )}
      </Stack>
      {map(fields, (field, index) =>
        field.type === 'value' ? (
          <SearchValueNode
            key={field.id}
            depth={depth + 1}
            formKey={`${prefix}children.${index}` as FieldPrefix}
            index={index}
            only={fields.length === 1}
            remove={removeChild}
            library={library}
          />
        ) : (
          <SearchGroupNode
            key={field.id}
            depth={depth + 1}
            formKey={`${prefix}children.${index}` as FieldPrefix}
            remove={removeChild}
            index={index}
            library={library}
          />
        ),
      )}
    </Stack>
  );
}
