import Add from '@mui/icons-material/Add';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import Remove from '@mui/icons-material/Remove';
import {
  Box,
  FormControl,
  IconButton,
  InputLabel,
  Stack,
  TextField,
} from '@mui/material';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import { PlexFilterResponseMeta, PlexFilterType } from '@tunarr/types/plex';
import { find, map, size } from 'lodash-es';
import { createContext, useContext, useState } from 'react';
import {
  Controller,
  FormProvider,
  useFieldArray,
  useForm,
  useFormContext,
} from 'react-hook-form';
import { usePlexFilters } from '../../hooks/plexHooks.ts';
import useStore from '../../store/index.ts';

type PlexQueryValueNode = {
  type: 'value';
  field: string;
  op: string;
  value: string;
};

type PlexAndNode = {
  type: 'op';
  op: 'and';
  children: PlexQuery[];
};
type PlexOrNode = {
  type: 'op';
  op: 'or';
  children: PlexQuery[];
};
type PlexOpNode = PlexAndNode | PlexOrNode;
type PlexQuery = PlexOpNode | PlexQueryValueNode;

function PlexSearchNode() {}

type PlexGroupNodeProps = {
  opType: PlexOpNode['op'];
};

type FilterMetadataContextType = {
  plexFilterMetadata: PlexFilterResponseMeta | undefined;
  libraryFilterMetadata: PlexFilterType | undefined;
};

const FilterMetadataContext = createContext<FilterMetadataContextType>({
  plexFilterMetadata: undefined,
  libraryFilterMetadata: undefined,
});

type NodeProps = { depth: number; formKey: string };
type PlexValueNodeProps = NodeProps & {
  index: number;
  formKey: string;
  only: boolean;
  remove(index: number): void;
};

function PlexValueNode({
  depth,
  index,
  formKey,
  only,
  remove,
}: PlexValueNodeProps) {
  const { control, setValue, watch } = useFormContext();
  const { plexFilterMetadata, libraryFilterMetadata } = useContext(
    FilterMetadataContext,
  );
  const selfValue = watch(formKey);
  console.log(selfValue);

  const lookupFieldOperators = (fieldType: string) => {
    if (!plexFilterMetadata || !libraryFilterMetadata) {
      return;
    }

    return find(plexFilterMetadata.FieldType, { type: fieldType })?.Operator;
  };

  return (
    libraryFilterMetadata &&
    libraryFilterMetadata.Field.length > 0 && (
      <Stack direction="row" gap={2} sx={{ pl: 4 * depth }}>
        <Controller
          control={control}
          name={`${formKey}.field`}
          render={({ field }) => (
            <FormControl size="small" margin="normal" sx={{ minWidth: 200 }}>
              <InputLabel>Field</InputLabel>
              <Select
                label="Field"
                MenuProps={{ sx: { maxHeight: 375 } }}
                {...field}
              >
                {map(libraryFilterMetadata.Field, (field) => {
                  return (
                    <MenuItem key={field.key} value={field.key}>
                      {field.title}
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
          )}
        />

        <FormControl size="small" margin="normal" sx={{ minWidth: 200 }}>
          <InputLabel>Operation</InputLabel>
          <Select value="==" label="Operation">
            {map(
              lookupFieldOperators(libraryFilterMetadata.Field[0].type),
              (ops) => {
                return (
                  <MenuItem key={ops.key} value={ops.key}>
                    {ops.title}
                  </MenuItem>
                );
              },
            )}
          </Select>
        </FormControl>
        <TextField label="Value" value="" size="small" margin="normal" />
        {!only && (
          <IconButton onClick={() => remove(index)}>
            <Remove />
          </IconButton>
        )}
      </Stack>
    )
  );
}

function PlexGroupNode({ depth, formKey }: NodeProps) {
  const { libraryFilterMetadata } = useContext(FilterMetadataContext);

  const { watch, control } = useFormContext();
  const [opType, setOpType] = useState<PlexOpNode['op']>('and');
  const [children, setChildren] = useState<PlexQueryValueNode[]>([]);
  const prefix = formKey.length === 0 ? '' : `${formKey}.`;
  const { fields, append, remove } = useFieldArray<PlexOpNode>({
    // Hack to get react-hook-form to work with recurisve data structures
    // References:
    //  * https://github.com/react-hook-form/react-hook-form/issues/4055
    //  * https://github.com/orgs/react-hook-form/discussions/7433
    name: `${prefix}children` as 'children',
  });

  console.log(watch());

  return (
    size(libraryFilterMetadata?.Field) > 0 && (
      <>
        <Stack direction="row" sx={{ pl: 4 * depth }}>
          <FormControl size="small" margin="normal" sx={{ minWidth: 200 }}>
            <InputLabel>Field</InputLabel>
            <Select<PlexOpNode['op']>
              value={opType}
              label="Field"
              MenuProps={{ sx: { maxHeight: 375 } }}
              onChange={(e) => setOpType(e.target.value as PlexOpNode['op'])}
            >
              <MenuItem value={'and'}>Match all of</MenuItem>
              <MenuItem value={'or'}>Match any of</MenuItem>
            </Select>
          </FormControl>
          <IconButton
            onClick={() =>
              append({ type: 'value', field: 'title', op: '==', value: '' })
            }
          >
            <Add />
          </IconButton>
          <IconButton
            onClick={() => append({ type: 'op', children: [], op: 'and' })}
          >
            <PlaylistAddIcon />
          </IconButton>
        </Stack>
        {map(fields, (field, index) =>
          field.type === 'value' ? (
            <PlexValueNode
              key={field.id}
              depth={depth + 1}
              formKey={`${prefix}children.${index}`}
              index={index}
              only={fields.length === 1}
              remove={remove}
            />
          ) : (
            <PlexGroupNode
              key={field.id}
              depth={depth + 1}
              formKey={`${prefix}children.${index}`}
            />
          ),
        )}
      </>
    )
  );
}

export function PlexSearchBuilder() {
  const selectedServer = useStore((s) => s.currentServer);
  const selectedLibrary = useStore((s) =>
    s.currentLibrary?.type === 'plex' ? s.currentLibrary : null,
  );

  const formMethods = useForm<PlexQuery>({
    defaultValues: {
      children: [],
      op: 'and',
    },
  });

  // console.log(formMethods.watch());

  const { data: plexFilterMetadata, isLoading: filterMetadataLoading } =
    usePlexFilters(
      selectedServer?.name ?? '',
      selectedLibrary?.library.key ?? '',
    );

  const libraryFilterMetadata = find(
    plexFilterMetadata?.Type,
    (t) => t.type === selectedLibrary?.library.type,
  );

  return (
    <FilterMetadataContext.Provider
      value={{ plexFilterMetadata, libraryFilterMetadata }}
    >
      <FormProvider {...formMethods}>
        <Box component="form">
          <PlexGroupNode depth={0} formKey="" />
        </Box>
      </FormProvider>
    </FilterMetadataContext.Provider>
  );
}
