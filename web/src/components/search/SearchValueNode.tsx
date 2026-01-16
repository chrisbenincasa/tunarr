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
import type { SearchField, SearchFilterValueNode } from '@tunarr/types/api';
import { OperatorsByType } from '@tunarr/types/api';
import { find, flatten, isArray, isNumber, map } from 'lodash-es';
import { useCallback } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import type { SearchFieldSpec } from '../../helpers/searchBuilderConstants.ts';
import {
  SearchFieldSpecs,
  getOperatorLabel,
} from '../../helpers/searchBuilderConstants.ts';
import { useGetFieldName } from '../../hooks/searchBuilderHooks.ts';
import { useDayjs } from '../../hooks/useDayjs.ts';
import type { FieldPrefix } from '../../types/SearchBuilder.ts';
import { DateSearchValueNode } from './DateSearchValueNode.tsx';
import { FacetStringValueSearchNode } from './FacetStringValueSearchNode.tsx';
import type { GroupNodeProps } from './SearchGroupNode.tsx';
import type { SearchForm } from './SearchInput.tsx';

type ValueNodeProps = GroupNodeProps & {
  formKey: FieldPrefix;
  only: boolean;
};

export function SearchValueNode(props: ValueNodeProps) {
  const {
    libraryId,
    mediaSourceId,
    mediaTypeFilter,
    depth,
    index,
    formKey,
    only,
    remove,
  } = props;
  const { control, watch, setValue } = useFormContext<SearchForm>();
  const selfValue = watch(formKey) as SearchFilterValueNode;
  const getFieldName = useGetFieldName(formKey);
  const dayjs = useDayjs();

  // useEffect(() => {
  //   const sub = watch((value, { name }) => {
  //     if (name === getFieldName('fieldSpec.value')) {
  //       const fieldValue = get(
  //         value,
  //         getFieldName('fieldSpec').split('.'),
  //       ) as SearchField;
  //       if (
  //         (fieldValue.type === 'facted_string' ||
  //           fieldValue.type === 'string') &&
  //         fieldValue.value.length > 1
  //       ) {
  //         setValue(getFieldName('fieldSpec.op'), 'in');
  //       }
  //     }
  //   });
  //   return () => sub.unsubscribe();
  // }, [formKey, getFieldName, setValue, watch]);

  const handleFieldChange = useCallback(
    (newField: string) => {
      const spec = find(
        SearchFieldSpecs,
        (spec) => (spec.alias ?? spec.key) === newField,
      );

      if (!spec) {
        return;
      }

      let fieldSpec: SearchField;
      switch (spec.type) {
        case 'string':
          fieldSpec = {
            key: spec.alias ?? spec.key,
            type: spec.type,
            name: spec.name,
            op: '=',
            value: [],
          };
          break;
        case 'facted_string':
          fieldSpec = {
            key: spec.alias ?? spec.key,
            type: spec.type,
            name: spec.name,
            op: '=',
            value: [],
          };
          break;
        case 'date':
          fieldSpec = {
            key: spec.alias ?? spec.key,
            type: spec.type,
            name: spec.name,
            op: '=',
            value: +dayjs(),
          };
          break;
        case 'numeric':
          fieldSpec = {
            key: spec.alias ?? spec.key,
            type: spec.type,
            name: spec.name,
            op: '=',
            value: 0,
          };
      }

      setValue(getFieldName('fieldSpec'), fieldSpec, {
        shouldTouch: true,
        shouldDirty: true,
      });
    },
    [dayjs, getFieldName, setValue],
  );

  const handleOpChange = useCallback(
    (newOp: string, originalOnChange: (...args: unknown[]) => void) => {
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

  const handleValueChange = useCallback(
    (
      spec: SearchFieldSpec<SearchField['type']>,
      value: string,
      originalOnChange: (...args: unknown[]) => void,
    ) => {
      console.log(value);
      if (selfValue.fieldSpec.type === 'numeric') {
        if (spec.normalizer) {
          originalOnChange(spec.normalizer(value));
        } else {
          const parsed = parseInt(value);
          if (isNaN(parsed)) {
            return;
          }
          originalOnChange(parsed);
        }
      } else {
        if (spec.normalizer) {
          originalOnChange([spec.normalizer(value)]);
        } else {
          originalOnChange([value]);
        }
      }
    },
    [selfValue.fieldSpec.type],
  );

  const renderValueInput = () => {
    const fieldSpec = selfValue.fieldSpec;
    const matchingSpec = Object.values(SearchFieldSpecs).find(
      (spec) => spec.alias ?? spec.key,
    );
    if (!matchingSpec) {
      return;
    }

    if (fieldSpec.type === 'facted_string') {
      return (
        <FacetStringValueSearchNode
          formKey={getFieldName('fieldSpec')}
          libraryId={libraryId}
          mediaSourceId={mediaSourceId}
          field={fieldSpec}
        />
      );
    } else if (fieldSpec.type === 'date') {
      return (
        <DateSearchValueNode
          formKey={getFieldName('fieldSpec')}
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
              onChange={(e) =>
                handleValueChange(matchingSpec, e.target.value, field.onChange)
              }
            />
          )}
        />
      );
    }
  };

  return (
    <Stack
      gap={1}
      sx={{ pl: 4 * depth, flexDirection: { xs: 'column', md: 'row' } }}
      maxWidth={'100%'}
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
              {seq.collect(SearchFieldSpecs, (spec) => {
                if (
                  mediaTypeFilter &&
                  isArray(spec.visibleForLibraryTypes) &&
                  !spec.visibleForLibraryTypes.includes(mediaTypeFilter)
                ) {
                  return null;
                }
                return (
                  <MenuItem
                    key={spec.alias ?? spec.key}
                    value={spec.alias ?? spec.key}
                  >
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
              value={field.value}
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
