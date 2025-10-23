import { Delete } from '@mui/icons-material';
import {
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from '@mui/material';
import { seq } from '@tunarr/shared/util';
import type {
  SearchField,
  SearchFilterValueNode,
  SearchRequest,
} from '@tunarr/types/api';
import { OperatorsByType } from '@tunarr/types/api';
import { find, flatten, get, isArray, isNumber, map } from 'lodash-es';
import { useCallback, useEffect } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import {
  SearchFieldSpec,
  getOperatorLabel,
} from '../../helpers/searchBuilderConstants.ts';
import { useGetFieldName } from '../../hooks/searchBuilderHooks.ts';
import type { FieldPrefix } from '../../types/SearchBuilder.ts';
import { DateSearchValueNode } from './DateSearchValueNode.tsx';
import { FacetStringValueSearchNode } from './FacetStringValueSearchNode.tsx';
import type { GroupNodeProps } from './SearchGroupNode.tsx';

type ValueNodeProps = GroupNodeProps & {
  formKey: FieldPrefix;
  only: boolean;
};

export function SearchValueNode(props: ValueNodeProps) {
  const { library, depth, index, formKey, only, remove } = props;
  const { control, watch, setValue } = useFormContext<SearchRequest>();
  const selfValue = watch(formKey) as SearchFilterValueNode;
  const getFieldName = useGetFieldName(formKey);

  useEffect(() => {
    const sub = watch((value, { name }) => {
      if (name === getFieldName('fieldSpec.value')) {
        const fieldValue = get(
          value,
          getFieldName('fieldSpec').split('.'),
        ) as SearchField;
        if (
          (fieldValue.type === 'facted_string' ||
            fieldValue.type === 'string') &&
          fieldValue.value.length > 1
        ) {
          setValue(getFieldName('fieldSpec.op'), 'in');
        }
      }
    });
    return () => sub.unsubscribe();
  }, [formKey, getFieldName, setValue, watch]);

  const handleFieldChange = useCallback(
    (newField: string) => {
      const field = find(SearchFieldSpec, (_, k) => k === newField);
      if (!field) {
        return;
      }

      let fieldSpec: SearchField;
      switch (field.type) {
        case 'string':
          fieldSpec = {
            key: field.key,
            type: field.type,
            name: field.name,
            op: '=',
            value: [''],
          };
          break;
        case 'facted_string':
          fieldSpec = {
            key: field.key,
            type: field.type,
            name: field.name,
            op: '=',
            value: [''],
          };
          break;
        case 'date':
          fieldSpec = {
            key: field.key,
            type: field.type,
            name: field.name,
            op: '=',
            value: 0,
          };
      }

      setValue(getFieldName('fieldSpec'), fieldSpec, { shouldTouch: true });
    },
    [getFieldName, setValue],
  );

  const handleOpChange = useCallback(
    (newOp: string, originalOnChange: (...args: unknown[]) => void) => {
      console.log('handle op change', newOp);
      if (
        selfValue.fieldSpec.type === 'numeric' ||
        selfValue.fieldSpec.type === 'date'
      ) {
        if (isNumber(selfValue.fieldSpec.value) && newOp === 'to') {
          setValue(getFieldName('fieldSpec.value'), [
            selfValue.fieldSpec.value,
            0,
          ] as [number, number]);
        } else if (isArray(selfValue.fieldSpec.value) && newOp !== 'to') {
          setValue(
            getFieldName('fieldSpec.value'),
            selfValue.fieldSpec.value[0],
          );
        }
      }
      originalOnChange(newOp);
    },
    [
      getFieldName,
      selfValue.fieldSpec.type,
      selfValue.fieldSpec.value,
      setValue,
    ],
  );

  const renderValueInput = () => {
    const fieldSpec = selfValue.fieldSpec;
    if (fieldSpec.type === 'facted_string') {
      return (
        <FacetStringValueSearchNode
          formKey={getFieldName('fieldSpec')}
          library={library}
          field={fieldSpec}
        />
      );
    } else if (fieldSpec.type === 'date') {
      return (
        <DateSearchValueNode
          formKey={getFieldName('fieldSpec')}
          library={library}
          field={fieldSpec}
        />
      );
    } else {
      return (
        <Controller
          control={control}
          name={getFieldName('fieldSpec.value')}
          render={({ field }) => (
            <TextField
              label="Value"
              size="small"
              {...field}
              onChange={(e) => field.onChange([e.target.value])}
            />
          )}
        />
      );
    }
  };

  const hasMultiValues =
    (selfValue.fieldSpec.type === 'facted_string' ||
      selfValue.fieldSpec.type === 'string') &&
    selfValue.fieldSpec.value.length > 1;

  return (
    <Stack
      gap={1}
      sx={{ pl: 4 * depth, flexDirection: { xs: 'column', md: 'row' } }}
    >
      <Controller
        control={control}
        name={getFieldName('fieldSpec.key')}
        render={({ field }) => (
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Field</InputLabel>
            <Select
              label="Field"
              MenuProps={{ sx: { maxHeight: 375 } }}
              {...field}
              onChange={(e) => handleFieldChange(e.target.value)}
            >
              {seq.collectMapValues(SearchFieldSpec, (spec, field) => {
                if (
                  library &&
                  isArray(spec.visibleForLibraryTypes) &&
                  !(spec.visibleForLibraryTypes as string[]).includes(
                    library.mediaType,
                  )
                ) {
                  return null;
                }
                return (
                  <MenuItem key={field} value={field}>
                    {spec.name}
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
        )}
      />

      <FormControl size="small" sx={{ minWidth: 200 }}>
        <InputLabel>Operator</InputLabel>
        <Controller
          control={control}
          name={getFieldName('fieldSpec.op')}
          render={({ field }) => (
            <Select
              label="Operator"
              {...field}
              value={hasMultiValues ? 'in' : field.value}
              disabled={hasMultiValues}
              onChange={(ev) => handleOpChange(ev.target.value, field.onChange)}
            >
              {flatten(
                map(OperatorsByType[selfValue.fieldSpec.type], (op) => (
                  <MenuItem key={op} value={op}>
                    {getOperatorLabel(selfValue.fieldSpec.type, op)}
                  </MenuItem>
                )),
              )}
            </Select>
          )}
        />
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
  );
}
