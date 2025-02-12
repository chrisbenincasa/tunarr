import { useCurrentPlexMediaSourceLibraryView } from '@/store/programmingSelector/selectors.ts';
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
import type {
  PlexFilter,
  PlexFilterOperatorNode,
  PlexFilterValueNode,
} from '@tunarr/types/api';
import type {
  PlexFilterResponseMeta,
  PlexFilterType,
} from '@tunarr/types/plex';
import dayjs from 'dayjs';
import { find, first, isEmpty, isUndefined, map, size } from 'lodash-es';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { SubmitHandler } from 'react-hook-form';
import {
  Controller,
  FormProvider,
  useFieldArray,
  useForm,
  useFormContext,
} from 'react-hook-form';
import { useSelectedLibraryPlexFilters } from '../../../hooks/plex/usePlexFilters.ts';
import { usePlexTags } from '../../../hooks/plex/usePlexTags.ts';
import { setPlexFilter } from '../../../store/programmingSelector/actions.ts';

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
  remove: (index: number) => void;
};
type PlexValueNodeProps = NodeProps & {
  formKey: '' | `children.${number}`;
  only: boolean;
};

const useGetFieldName = (formKey: '' | `children.${number}`) => {
  return useCallback(
    <T extends string>(field: T): `${T}` | `children.${number}.${T}` => {
      return formKey === '' ? `${field}` : `${formKey}.${field}`;
    },
    [formKey],
  );
};

export function PlexValueNode({
  depth,
  index,
  formKey,
  only,
  remove,
}: PlexValueNodeProps) {
  const { control, watch, setValue } = useFormContext<PlexFilter>();
  const { plexFilterMetadata, libraryFilterMetadata } = useContext(
    FilterMetadataContext,
  );
  const selfValue = (
    formKey === '' ? watch() : watch(formKey)
  ) as PlexFilterValueNode;

  const getFieldName = useGetFieldName(formKey);

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
    return findPlexField(selfValue.field);
  }, [selfValue.field, findPlexField]);

  const { data: plexTags, isLoading: plexTagsLoading } = usePlexTags(
    plexFilter?.type === 'tag' ? plexFilter.key.replace('show.', '') : '',
  );

  const lookupFieldOperators = useCallback(
    (fieldType: string) => {
      if (!plexFilterMetadata || !libraryFilterMetadata) {
        return [];
      }

      return (
        find(plexFilterMetadata.FieldType, { type: fieldType })?.Operator ?? []
      );
    },
    [libraryFilterMetadata, plexFilterMetadata],
  );

  const handleFieldChange = useCallback(
    (newField: string) => {
      const newPlexFilter = findPlexField(newField);
      if (newPlexFilter) {
        setValue(getFieldName('field'), newField);
      }

      if (
        newPlexFilter &&
        plexFilter &&
        newPlexFilter.type !== plexFilter.type
      ) {
        const operators = lookupFieldOperators(newPlexFilter.type);
        if (operators.length > 0) {
          setValue(getFieldName('op'), operators[0].key);
        }
        if (newPlexFilter.type === 'boolean') {
          setValue(getFieldName('value'), '1');
        }
      }
    },
    [findPlexField, getFieldName, lookupFieldOperators, plexFilter, setValue],
  );

  const autocompleteOptions = useMemo(() => {
    return map(plexTags?.Directory, (tag) => ({
      label: tag.title,
      value: tag.key,
    }));
  }, [plexTags]);

  const [localValue, setLocalValue] = useState('');

  const renderValueInput = () => {
    if (plexFilter?.type === 'tag') {
      return (
        <Controller
          control={control}
          name={getFieldName('value')}
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
    } else if (plexFilter?.type === 'date') {
      return (
        <Controller
          control={control}
          name={getFieldName('value')}
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
              onChange={(e) => field.onChange(e?.format('L'))}
            />
          )}
        />
      );
    } else if (plexFilter?.type === 'boolean') {
      return null;
    } else {
      return (
        <Controller
          control={control}
          name={getFieldName('value')}
          render={({ field }) => (
            <TextField label="Value" size="small" {...field} />
          )}
        />
      );
    }
  };

  return (
    libraryFilterMetadata &&
    (libraryFilterMetadata.Field?.length ?? 0) > 0 && (
      <Stack
        gap={1}
        sx={{ pl: 4 * depth, flexDirection: { xs: 'column', md: 'row' } }}
      >
        <Controller
          control={control}
          name={getFieldName('field')}
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
              name={getFieldName('op')}
              render={({ field }) => (
                <Select label="Operation" {...field}>
                  {map(lookupFieldOperators(plexFilter.type), (ops) => {
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

  const { control } = useFormContext();
  const prefix = formKey.length === 0 ? '' : `${formKey}.`;
  const getFieldName = useGetFieldName(formKey);

  const {
    fields,
    append,
    remove: removeChild,
  } = useFieldArray<PlexFilterOperatorNode>({
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
  }, [libraryFilterMetadata, plexFilterMetadata]);

  return (
    size(libraryFilterMetadata?.Field) > 0 &&
    !isUndefined(defaultField) && (
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
                <Select<PlexFilterOperatorNode['op']>
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

export function PlexFilterBuilder(
  { advanced }: { advanced?: boolean } = { advanced: false },
) {
  const formMethods = useForm<PlexFilter>({
    defaultValues: {
      children: [],
      op: 'and',
      type: 'op',
    },
  });
  const [limitTo, setLimitTo] = useState('');
  const rootNodeType = formMethods.watch('type');

  const { data: plexFilterMetadata } = useSelectedLibraryPlexFilters();
  const mediaSourceView = useCurrentPlexMediaSourceLibraryView();

  const libraryFilterMetadata = find(
    plexFilterMetadata?.Type,
    (t) => t.type === mediaSourceView?.library.childType,
  );

  const handleSearch: SubmitHandler<PlexFilter> = (data) => {
    const limitInt = parseInt(limitTo);
    setPlexFilter(data, isNaN(limitInt) ? undefined : limitInt);
  };

  useEffect(() => {
    if (advanced) {
      formMethods.reset({
        children: [],
        op: 'and',
        type: 'op',
      });
    } else {
      formMethods.reset({
        type: 'value',
        op: '=',
        field:
          mediaSourceView?.library.childType === 'show'
            ? 'show.title'
            : 'title',
        value: '',
      });
    }
  }, [advanced, formMethods, formMethods.reset, mediaSourceView?.library.type]);

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
            <Stack gap={2} useFlexGap>
              {rootNodeType === 'op' ? (
                <PlexGroupNode
                  depth={0}
                  formKey=""
                  index={0}
                  remove={() => {}}
                />
              ) : (
                <PlexValueNode
                  only
                  depth={0}
                  formKey=""
                  index={0}
                  remove={() => {}}
                />
              )}

              <TextField
                error={!isEmpty(limitTo) && isNaN(parseInt(limitTo))}
                sx={{ width: 200 }}
                value={limitTo}
                onChange={(e) => setLimitTo(e.target.value)}
                label="Limit"
                size="small"
                helperText={
                  !isEmpty(limitTo) && isNaN(parseInt(limitTo))
                    ? 'Limit must be numeric'
                    : null
                }
              />

              <Box>
                <Button
                  sx={{ maxWidth: 200 }}
                  type="submit"
                  variant="contained"
                >
                  Search
                </Button>
              </Box>
            </Stack>
          </Box>
        </Box>
      </FormProvider>
    </FilterMetadataContext.Provider>
  );
}
