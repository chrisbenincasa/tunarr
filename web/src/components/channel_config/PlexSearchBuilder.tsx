import Add from '@mui/icons-material/Add';
import Delete from '@mui/icons-material/Delete';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  Stack,
  TextField,
  Tooltip,
} from '@mui/material';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import { DatePicker } from '@mui/x-date-pickers';
import { PlexFilterResponseMeta, PlexFilterType } from '@tunarr/types/plex';
import dayjs from 'dayjs';
import { find, first, isUndefined, map, size } from 'lodash-es';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import {
  Controller,
  FormProvider,
  SubmitHandler,
  useFieldArray,
  useForm,
  useFormContext,
} from 'react-hook-form';
import {
  PlexOpNode,
  PlexQuery,
  PlexQueryValueNode,
} from '../../helpers/plexSearchUtil.ts';
import { usePlexFilters, usePlexTags } from '../../hooks/plexHooks.ts';
import useStore from '../../store/index.ts';
import { setPlexQuery } from '../../store/programmingSelector/actions.ts';

type FilterMetadataContextType = {
  plexFilterMetadata: PlexFilterResponseMeta | undefined;
  libraryFilterMetadata: PlexFilterType | undefined;
};

const FilterMetadataContext = createContext<FilterMetadataContextType>({
  plexFilterMetadata: undefined,
  libraryFilterMetadata: undefined,
});

type NodeProps = {
  index: number;
  depth: number;
  formKey: '' | `children.${number}`;
  remove(index: number): void;
};
type PlexValueNodeProps = NodeProps & {
  formKey: `children.${number}`;
  only: boolean;
};

function PlexValueNode({
  depth,
  index,
  formKey,
  only,
  remove,
}: PlexValueNodeProps) {
  const { control, watch, setValue } = useFormContext<PlexQuery>();
  const { plexFilterMetadata, libraryFilterMetadata } = useContext(
    FilterMetadataContext,
  );
  const selfValue = watch(formKey) as PlexQueryValueNode;

  const findPlexField = useCallback(
    (field: string) => {
      if (!plexFilterMetadata || !libraryFilterMetadata) {
        return;
      }

      return find(libraryFilterMetadata.Field, { key: field });
    },
    [plexFilterMetadata, libraryFilterMetadata],
  );

  const plexFilter = useMemo(() => {
    return findPlexField(selfValue.field)!;
  }, [selfValue.field]);

  const { data: plexTags, isLoading: plexTagsLoading } = usePlexTags(
    plexFilter.type === 'tag' ? plexFilter.key : '',
  );

  const lookupFieldOperators = (fieldType: string) => {
    if (!plexFilterMetadata || !libraryFilterMetadata) {
      return [];
    }

    return (
      find(plexFilterMetadata.FieldType, { type: fieldType })?.Operator ?? []
    );
  };

  const handleFieldChange = useCallback(
    (newField: string) => {
      const newPlexFilter = findPlexField(newField);
      if (newPlexFilter) {
        setValue(`${formKey}.field`, newField);
      }

      if (
        newPlexFilter &&
        plexFilter &&
        newPlexFilter.type !== plexFilter.type
      ) {
        const operators = lookupFieldOperators(newPlexFilter.type);
        if (operators.length > 0) {
          setValue(`${formKey}.op`, operators[0].key);
        }
      }
    },
    [plexFilter, setValue],
  );

  const autocompleteOptions = useMemo(() => {
    return map(plexTags?.Directory, (tag) => ({
      label: tag.title,
      value: tag.key,
    }));
  }, [plexTags]);

  const [localValue, setLocalValue] = useState('');

  const renderValueInput = () => {
    if (plexFilter.type === 'tag') {
      return (
        <Controller
          control={control}
          name={`${formKey}.value`}
          render={({ field }) => {
            const value = find(autocompleteOptions, { value: field.value });
            return (
              <Autocomplete
                disablePortal
                size="small"
                loading={plexTagsLoading}
                value={value}
                inputValue={localValue}
                onChange={(_, newValue) => field.onChange(newValue?.value)}
                onInputChange={(_, newInputValue) => {
                  setLocalValue(newInputValue);
                }}
                sx={{ minWidth: 200 }}
                renderInput={(params) => (
                  <TextField
                    label="Value"
                    {...params}
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {plexTagsLoading ? (
                            <CircularProgress color="inherit" size={20} />
                          ) : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                options={autocompleteOptions}
              />
            );
          }}
        />
      );
    } else if (plexFilter.type === 'date') {
      return (
        <Controller
          control={control}
          name={`${formKey}.value`}
          render={({ field }) => (
            <DatePicker
              sx={{ height: 40, mt: 2 }}
              label="Value"
              slotProps={{
                textField: {
                  size: 'small',
                },
              }}
              value={dayjs(field.value)}
              onChange={(e) => field.onChange(e?.format('YYYY-MM-DD'))}
            />
          )}
        />
      );
    } else {
      return (
        <Controller
          control={control}
          name={`${formKey}.value`}
          render={({ field }) => (
            <TextField label="Value" size="small" {...field} />
          )}
        />
      );
    }
  };

  return (
    libraryFilterMetadata &&
    libraryFilterMetadata.Field.length > 0 && (
      <Stack direction="row" gap={2} sx={{ pl: 4 * depth }}>
        <Controller
          control={control}
          name={`${formKey}.field`}
          render={({ field }) => (
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Field</InputLabel>
              <Select
                label="Field"
                MenuProps={{ sx: { maxHeight: 375 } }}
                {...field}
                onChange={(e) => handleFieldChange(e.target.value)}
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

        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Operation</InputLabel>
          {plexFilter && (
            <Controller
              control={control}
              name={`${formKey}.op`}
              render={({ field }) => (
                <Select label="Operation" {...field}>
                  {map(lookupFieldOperators(plexFilter!.type), (ops) => {
                    return (
                      <MenuItem key={ops.key} value={ops.key}>
                        {ops.title}
                      </MenuItem>
                    );
                  })}
                </Select>
              )}
            />
          )}
        </FormControl>
        {renderValueInput()}
        {!only && (
          <span>
            <IconButton onClick={() => remove(index)}>
              <Delete />
            </IconButton>
          </span>
        )}
      </Stack>
    )
  );
}

function PlexGroupNode({
  depth,
  formKey,
  remove: removeSelf,
  index,
}: NodeProps) {
  const { plexFilterMetadata, libraryFilterMetadata } = useContext(
    FilterMetadataContext,
  );

  console.log(formKey);
  const { control } = useFormContext();
  const prefix = formKey.length === 0 ? '' : `${formKey}.`;
  const {
    fields,
    append,
    remove: removeChild,
  } = useFieldArray<PlexOpNode>({
    // Hack to get react-hook-form to work with recurisve data structures
    // References:
    //  * https://github.com/react-hook-form/react-hook-form/issues/4055
    //  * https://github.com/orgs/react-hook-form/discussions/7433
    name: `${prefix}children` as 'children',
  });

  const defaultField = useMemo(() => {
    if (
      !plexFilterMetadata ||
      !libraryFilterMetadata ||
      size(libraryFilterMetadata.Field) === 0
    ) {
      return;
    }

    const field = first(libraryFilterMetadata.Field);
    const op = first(
      find(plexFilterMetadata.FieldType, { type: field?.type })?.Operator,
    );
    if (field && op) {
      return {
        field,
        operator: op,
      };
    }
  }, [libraryFilterMetadata]);

  return (
    size(libraryFilterMetadata?.Field) > 0 &&
    !isUndefined(defaultField) && (
      <Stack direction="column" gap={2}>
        <Stack direction="row" sx={{ pl: 4 * depth, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Field</InputLabel>
            <Controller
              control={control}
              name={`${formKey}.op`}
              render={({ field }) => (
                <Select<PlexOpNode['op']>
                  label="Field"
                  MenuProps={{ sx: { maxHeight: 375 } }}
                  {...field}
                >
                  <MenuItem value={'and'}>Match all of</MenuItem>
                  <MenuItem value={'or'}>Match any of</MenuItem>
                </Select>
              )}
            />
          </FormControl>
          <Tooltip title="Add field">
            <IconButton
              onClick={() =>
                append({
                  type: 'value',
                  field: defaultField.field.key,
                  op: defaultField.operator.key,
                  value: '',
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
            <PlexValueNode
              key={field.id}
              depth={depth + 1}
              formKey={`${prefix}children.${index}` as `children.${number}`}
              index={index}
              only={fields.length === 1}
              remove={removeChild}
            />
          ) : (
            <PlexGroupNode
              key={field.id}
              depth={depth + 1}
              formKey={`${prefix}children.${index}` as `children.${number}`}
              remove={removeChild}
              index={index}
            />
          ),
        )}
      </Stack>
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
      type: 'op',
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

  const handleSearch: SubmitHandler<PlexQuery> = (data) => {
    setPlexQuery(data);
  };

  return (
    <FilterMetadataContext.Provider
      value={{ plexFilterMetadata, libraryFilterMetadata }}
    >
      <FormProvider {...formMethods}>
        <Box
          component="form"
          onSubmit={formMethods.handleSubmit(handleSearch, console.error)}
        >
          <Box sx={{ my: 2 }}>
            <PlexGroupNode depth={0} formKey="" index={0} remove={() => {}} />
          </Box>
          <Button type="submit">Search</Button>
        </Box>
      </FormProvider>
    </FilterMetadataContext.Provider>
  );
}
