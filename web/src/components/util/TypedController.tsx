import {
  Checkbox,
  CheckboxProps,
  TextField,
  TextFieldProps,
} from '@mui/material';
import { get, has, isFunction, isNil, isUndefined, mapValues } from 'lodash-es';
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
  Validate,
} from 'react-hook-form';
import { handleNumericFormValue } from '../../helpers/util.ts';

type RenderFunc<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
  Result = React.ReactElement,
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
}) => Result;

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

  const validateNumeric = useCallback(
    (v: number) => {
      return isFinite(v)
        ? undefined
        : `${props.prettyFieldName ?? props.name} should be numeric.`;
    },
    [props.prettyFieldName, props.name],
  );

  const passedValidate = props.rules?.validate;
  let validate: Record<
    string,
    Validate<FieldPathValue<TFieldValues, TName>, TFieldValues>
  > = { validateNumeric };
  if (isFunction(passedValidate)) {
    validate['custom'] = passedValidate;
  } else if (!isUndefined(passedValidate)) {
    validate = { ...validate, ...passedValidate };
  }

  return (
    <TypedController<TFieldValues, TName, string | number>
      {...props}
      rules={{
        validate,
        ...(props.rules ?? {}),
      }}
      toFormType={handleStr}
    />
  );
};

type TextFieldPropsWithFuncs<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = {
  [Key in keyof TextFieldProps]:
    | TextFieldProps[Key]
    | RenderFunc<TFieldValues, TName, TextFieldProps[Key]>;
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
    TextFieldProps?: TextFieldPropsWithFuncs<TFieldValues, TName>;
  },
) => {
  return (
    <NumericFormController
      {...props}
      render={(renderProps) => {
        const {
          field,
          formState: { errors },
        } = renderProps;

        const fieldError = errors[props.name] as FieldError | undefined;
        let helperText: React.ReactNode = null;
        const helperTextValue = props.TextFieldProps?.helperText;
        let passedHelperText: React.ReactNode = null;
        if (isFunction(helperTextValue)) {
          passedHelperText = helperTextValue(renderProps);
        } else if (!isNil(helperTextValue)) {
          passedHelperText = helperTextValue;
        }

        if (fieldError?.message && helperTextValue) {
          helperText = (
            <>
              {fieldError?.message}
              <br />
              {passedHelperText}
            </>
          );
        } else if (fieldError?.message) {
          helperText = fieldError?.message;
        } else if (helperTextValue) {
          helperText = passedHelperText;
        }

        const fieldProps: TextFieldProps = mapValues(
          props.TextFieldProps,
          (p) => {
            if (isFunction(p)) {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-return
              return p(renderProps);
            } else {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-return
              return p;
            }
          },
        );

        return (
          <TextField
            error={!isNil(errors[props.name])}
            {...field}
            {...fieldProps}
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
