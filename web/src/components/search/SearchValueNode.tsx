import { Delete } from '@mui/icons-material';
import {
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
} from '@mui/material';
import { seq } from '@tunarr/shared/util';
import type {
  NumericOperators,
  SearchField,
  SearchFilterValueNode,
  StringOperators,
} from '@tunarr/types/schemas';
import { OperatorsByType } from '@tunarr/types/schemas';
import { find, isArray, isNumber } from 'lodash-es';
import { useCallback, useMemo } from 'react';
import type { ControllerRenderProps } from 'react-hook-form';
import { Controller, useFormContext } from 'react-hook-form';
import {
  SearchFieldSpecs,
  getOperatorLabel,
  isUiSearchFieldSpecOfType,
} from '../../helpers/searchBuilderConstants.ts';
import { useGetFieldName } from '../../hooks/searchBuilderHooks.ts';
import { useDayjs } from '../../hooks/useDayjs.ts';
import type { FieldPrefix } from '../../types/SearchBuilder.ts';
import { DateSearchValueNode } from './DateSearchValueNode.tsx';
import { FacetStringValueSearchNode } from './FacetStringValueSearchNode.tsx';
import { NumericValueSearchNode } from './NumericValueSearchNode.tsx';
import type { GroupNodeProps } from './SearchGroupNode.tsx';
import type { SearchForm } from './SearchInput.tsx';
import { StringValueSearchNode } from './StringValueSearchNode.tsx';

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
  const [selfValue, searchField] = watch([formKey, `${formKey}.fieldSpec`]) as [
    SearchFilterValueNode,
    SearchField,
  ];
  const matchingSpec = useMemo(() => {
    return Object.values(SearchFieldSpecs).find((spec) =>
      spec.name ? searchField.name === spec.name : spec.key === searchField.key,
    );
  }, [searchField]);
  const getFieldName = useGetFieldName(formKey);
  const dayjs = useDayjs();

  const handleFieldChange = useCallback(
    (newField: string) => {
      const spec = find(
        SearchFieldSpecs,
        (spec) => (spec.name ?? spec.key) === newField,
      );

      if (!spec) {
        return;
      }

      let fieldSpec: SearchField;
      switch (spec.type) {
        case 'string':
          fieldSpec = {
            name: spec.name,
            key: spec.key,
            type: spec.type,
            op: '=',
            value: [],
          };
          break;
        case 'faceted_string':
          fieldSpec = {
            name: spec.name,
            key: spec.key,
            type: spec.type,
            op: '=',
            value: [],
          };
          break;
        case 'date':
          fieldSpec = {
            name: spec.name,
            key: spec.key,
            type: spec.type,
            op: '=',
            value: +dayjs(),
          };
          break;
        case 'numeric':
          fieldSpec = {
            name: spec.name,
            key: spec.key,
            type: spec.type,
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
    (newOp: string) => {
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
      setValue(
        getFieldName('fieldSpec.op'),
        newOp as StringOperators | NumericOperators,
      );
    },
    [
      getFieldName,
      selfValue.fieldSpec.type,
      selfValue.fieldSpec.value,
      setValue,
    ],
  );

  const renderValueInput = useMemo(() => {
    if (!matchingSpec) {
      return;
    }

    if (isUiSearchFieldSpecOfType(matchingSpec, 'faceted_string')) {
      return (
        <FacetStringValueSearchNode
          formKey={getFieldName('fieldSpec')}
          libraryId={libraryId}
          mediaSourceId={mediaSourceId}
          field={matchingSpec}
        />
      );
    } else if (isUiSearchFieldSpecOfType(matchingSpec, 'date')) {
      return (
        <DateSearchValueNode
          formKey={getFieldName('fieldSpec')}
          field={matchingSpec}
        />
      );
    } else if (isUiSearchFieldSpecOfType(matchingSpec, 'numeric')) {
      return (
        <NumericValueSearchNode
          formKey={getFieldName('fieldSpec')}
          uiSpec={matchingSpec}
        />
      );
    } else if (isUiSearchFieldSpecOfType(matchingSpec, 'string')) {
      return (
        <StringValueSearchNode
          field={matchingSpec}
          formKey={getFieldName('fieldSpec')}
        />
      );
    }

    return;
  }, [getFieldName, libraryId, matchingSpec, mediaSourceId]);

  const renderOperatorInput = useCallback(
    (field: ControllerRenderProps<SearchForm, `${FieldPrefix}.fieldSpec`>) => {
      const multiple =
        isArray(selfValue.fieldSpec.value) &&
        selfValue.fieldSpec.value.length > 1;
      const operators = seq.collect(
        OperatorsByType[selfValue.fieldSpec.type],
        (operator) => {
          if (multiple && operator !== 'in' && operator !== 'not in') {
            return;
          }
          return (
            <MenuItem key={operator} value={operator}>
              {getOperatorLabel(selfValue.fieldSpec.type, operator)}
            </MenuItem>
          );
        },
      );

      return (
        <Select
          label="Operator"
          {...field}
          value={field.value.op}
          onChange={(ev) => handleOpChange(ev.target.value)}
        >
          {operators}
        </Select>
      );
    },
    [handleOpChange, selfValue.fieldSpec.type, selfValue.fieldSpec.value],
  );

  return (
    <Stack
      gap={1}
      sx={{ pl: 4 * depth, flexDirection: { xs: 'column', md: 'row' } }}
      maxWidth={'100%'}
    >
      <Controller
        control={control}
        name={getFieldName('fieldSpec')}
        render={({ field }) => (
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Field</InputLabel>
            <Select
              label="Field"
              MenuProps={{ sx: { maxHeight: 375 } }}
              value={field.value.name ?? field.value.key}
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
                    key={spec.name ?? spec.key}
                    value={spec.name ?? spec.key}
                  >
                    {spec.displayName}
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
          name={getFieldName('fieldSpec')}
          render={({ field }) => renderOperatorInput(field)}
        />
      </FormControl>

      {renderValueInput}
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
