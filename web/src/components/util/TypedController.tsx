import {
  Checkbox,
  CheckboxProps,
  TextField,
  TextFieldProps,
} from '@mui/material';
import { get, has, isFinite, isNil } from 'lodash-es';
import { useCallback } from 'react';
import {
  Controller,
  ControllerFieldState,
  ControllerRenderProps,
  FieldError,
  FieldPath,
  FieldPathValue,
  FieldValues,
  UseControllerProps,
  UseFormStateReturn,
} from 'react-hook-form';
import { handleNumericFormValue } from '../../helpers/util.ts';

type RenderFunc<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = ({
  field,
  fieldState,
  formState,
  helperText,
}: {
  field: ControllerRenderProps<TFieldValues, TName>;
  fieldState: ControllerFieldState;
  formState: UseFormStateReturn<TFieldValues>;
  helperText?: React.ReactNode;
}) => React.ReactElement;

type Props<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
  TValue = FieldPathValue<TFieldValues, TName>,
  ExtractedType = string,
> = {
  prettyFieldName?: string;
  render: RenderFunc<TFieldValues, TName>;
  // Transform the value from the raw form to the value expected in the
  // underlying form type
  toFormType?: (value: ExtractedType) => TValue;
  // How to extract the raw form value from the onChange event.
  // Defaults to trying to use event.target.value on the first argument
  // to onChange
  valueExtractor?: (...event: unknown[]) => ExtractedType;
} & UseControllerProps<TFieldValues, TName>;

// Default to trying to extract event.target.value as a string from
// the first parameter in the spread
const defaultValueExtractor = (...event: unknown[]) => {
  if (event.length > 0 && has(event[0], 'target.value')) {
    return get(event[0], 'target.value') as unknown;
  }
  return;
};

// A wrapper for the react-hook-form Controller component which adds
// transformers to handle typed inputs.
export const TypedController = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
  TValue = FieldPathValue<TFieldValues, TName>,
  ExtractedType = string,
>(
  props: Props<TFieldValues, TName, TValue, ExtractedType>,
) => {
  const extractor = props.valueExtractor ?? defaultValueExtractor;

  const handleRender: RenderFunc<TFieldValues, TName> = (original) => {
    const originalOnChange = original.field.onChange;
    const newParams = {
      ...original,
      field: {
        ...original.field,
        onChange: (...event: unknown[]) => {
          // If we have a value transformer, attempt to use the extractor
          // to get the raw event value and then pass it to the transformer
          if (props.toFormType) {
            // We're making a lot of assumptions here...
            const extractedValue = extractor(...event) as ExtractedType;
            if (isNil(extractedValue)) {
              console.warn(
                `Extracted null value for form field "${props.name}"!`,
              );
            }
            const transformedValue = props.toFormType(extractedValue);
            originalOnChange(...[transformedValue, ...event]);
          } else {
            originalOnChange(...event);
          }
        },
      },
    };

    return props.render(newParams);
  };

  return <Controller {...props} render={handleRender} />;
};

export const NumericFormController = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(
  props: Omit<Props<TFieldValues, TName, string | number>, 'transformer'> & {
    float?: boolean;
  },
) => {
  const handleStr = useCallback(
    (value: string) => {
      const v = handleNumericFormValue(value, !!props.float);
      if (isNaN(v)) {
        return value;
      }
      return v;
    },
    [props.float],
  );

  return (
    <TypedController<TFieldValues, TName, string | number>
      rules={{
        validate: {
          numeric: (v) =>
            isFinite(v) ||
            `${props.prettyFieldName ?? props.name} should be numeric.`,
        },
        ...(props.rules ?? {}),
      }}
      toFormType={handleStr}
      {...props}
    />
  );
};

export const NumericFormControllerText = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(
  props: Omit<
    Props<TFieldValues, TName, string | number>,
    'transformer' | 'render'
  > & {
    float?: boolean;
    TextFieldProps?: TextFieldProps;
  },
) => {
  return (
    <NumericFormController
      {...props}
      render={({ field, formState: { errors } }) => {
        const fieldError = errors[props.name] as FieldError | undefined;
        let helperText: React.ReactNode = null;
        if (fieldError?.message && props.TextFieldProps?.helperText) {
          helperText = (
            <>
              {fieldError?.message}
              <br />
              {props.TextFieldProps.helperText}
            </>
          );
        } else if (fieldError?.message) {
          helperText = fieldError?.message;
        } else if (props.TextFieldProps?.helperText) {
          helperText = props.TextFieldProps?.helperText;
        }

        return (
          <TextField
            label="Threads"
            error={!isNil(errors[props.name])}
            {...field}
            {...props.TextFieldProps}
            helperText={helperText}
          />
        );
      }}
    />
  );
};

export const CheckboxFormController = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
  Value = FieldPathValue<TFieldValues, TName> extends boolean ? boolean : never,
>(
  props: Omit<Props<TFieldValues, TName, Value>, 'transformer' | 'render'> & {
    CheckboxProps?: CheckboxProps;
  },
) => {
  return (
    <Controller
      {...props}
      render={({ field }) => (
        <Checkbox {...props.CheckboxProps} {...field} checked={field.value} />
      )}
    />
  );
};
