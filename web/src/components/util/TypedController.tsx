import type { CheckboxProps, TextFieldProps } from '@mui/material';
import { Checkbox, TextField } from '@mui/material';
import {
  get,
  has,
  isFunction,
  isNil,
  isObject,
  isRegExp,
  isUndefined,
  mapValues,
} from 'lodash-es';
import React, { useCallback } from 'react';
import type {
  ControllerFieldState,
  ControllerRenderProps,
  FieldError,
  FieldPath,
  FieldPathValue,
  FieldValues,
  RegisterOptions,
  UseControllerProps,
  UseFormStateReturn,
  Validate,
  ValidationRule,
} from 'react-hook-form';
import { Controller } from 'react-hook-form';
import type { Primitive } from 'ts-essentials';
import { type DeepRequired } from 'ts-essentials';
import {
  handleNumericFormValue,
  isNonEmptyString,
} from '../../helpers/util.ts';

type RenderFunc<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
  Result = React.ReactElement,
> = ({
  field,
  fieldState,
  formState,
  helperText,
  displayValue,
}: {
  field: ControllerRenderProps<TFieldValues, TName>;
  fieldState: ControllerFieldState;
  formState: UseFormStateReturn<TFieldValues>;
  helperText?: React.ReactNode;
  displayValue?: string;
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
  // Try this out and see if it works...

  // TODO(http://github.com/chrisbenincasa/tunarr/issues/279) - fix decimal support
  // const rawField = props.control?._getWatch(props.name, props.defaultValue);
  // const [rawValue, setRawValue] = useState<string | undefined>(
  //   toString(rawField),
  // );

  const handleRender: RenderFunc<TFieldValues, TName> = (original) => {
    const originalOnChange = original.field.onChange;
    const newParams = {
      ...original,
      field: {
        ...original.field,
        onChange: (...event: unknown[]) => {
          // If we have a value transformer, attempt to use the extractor
          // to get the raw event value and then pass it to the transformer
          const extractedValue = extractor(...event) as ExtractedType;
          // setRawValue(toString(extractedValue));
          if (props.toFormType) {
            // We're making a lot of assumptions here...
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
      // displayValue: rawValue,
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

type ControllerRegisterOptions<
  TFieldValues extends FieldValues = FieldValues,
  TFieldName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = Omit<
  RegisterOptions<TFieldValues, TFieldName>,
  'valueAsNumber' | 'valueAsDate' | 'setValueAs' | 'disabled'
>;

type NativeRuleTypes = Pick<
  RegisterOptions<FieldValues>,
  keyof ControllerRegisterOptions
>;

type FmtFunc<RuleValue> = (fieldName: string, value: RuleValue) => string;

type ErrorMessageMap = {
  [K in keyof NativeRuleTypes]-?: FmtFunc<
    DeepRequired<Extract<NativeRuleTypes[K], Primitive>>
  >;
};

const DefaultErrorMessageMap: Partial<ErrorMessageMap> = {
  min: (fieldName: string, value) => `${fieldName} must be >= ${value}`,
} as const;

function getDefaultErrorMessage<
  TFieldValues extends FieldValues = FieldValues,
  TFieldName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(
  fieldError: FieldError,
  rules: ControllerRegisterOptions<TFieldValues, TFieldName> | undefined,
  prettyFieldName: string,
) {
  const errorType = fieldError.type as keyof NativeRuleTypes;
  const defaultError = DefaultErrorMessageMap[errorType];
  if (defaultError && !isUndefined(rules)) {
    const value = rules[errorType] as ValidationRule<
      string | number | boolean | RegExp
    >;
    let finalValue: string | number | boolean | undefined;
    if (!isObject(value)) {
      finalValue = value;
    } else if (isRegExp(value)) {
      finalValue = value.toString();
    } else {
      finalValue = isRegExp(value.value) ? value.value.toString() : value.value;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    return defaultError(prettyFieldName, finalValue as any);
  }

  return;
}

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
  const prettyName =
    props.prettyFieldName ??
    (isNonEmptyString(props.TextFieldProps?.label)
      ? props.TextFieldProps?.label
      : undefined) ??
    props.name;
  return (
    <NumericFormController
      {...props}
      render={(renderProps) => {
        const {
          field,
          formState: { errors },
          displayValue,
        } = renderProps;

        const fieldError = get(errors, props.name) as FieldError | undefined;
        let helperText: React.ReactNode = null;
        const helperTextValue = props.TextFieldProps?.helperText;
        let passedHelperText: React.ReactNode = null;
        if (isFunction(helperTextValue)) {
          passedHelperText = helperTextValue(renderProps);
        } else if (!isNil(helperTextValue)) {
          passedHelperText = helperTextValue;
        }

        let fieldErrorMessage = fieldError?.message;
        if (!isNil(fieldError) && !isNonEmptyString(fieldErrorMessage)) {
          fieldErrorMessage = getDefaultErrorMessage(
            fieldError,
            props.rules,
            prettyName,
          );
        }

        if (isNonEmptyString(fieldErrorMessage) && helperTextValue) {
          helperText = (
            <>
              {fieldError?.message}
              <br />
              {passedHelperText}
            </>
          );
        } else if (fieldErrorMessage) {
          helperText = fieldErrorMessage;
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
            error={!isNil(fieldError)}
            {...field}
            {...fieldProps}
            value={displayValue ?? field.value}
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
    negate?: boolean;
    CheckboxProps?: CheckboxProps;
  },
) => {
  const renderCheckbox = (
    field: ControllerRenderProps<TFieldValues, TName>,
  ) => {
    const onChange = props.negate
      ? (_: React.SyntheticEvent, value: boolean) => field.onChange(!value)
      : field.onChange;
    const checked = props.negate ? !field.value : field.value;
    return (
      <Checkbox
        {...props.CheckboxProps}
        {...field}
        checked={checked}
        onChange={onChange}
      />
    );
  };

  return (
    <Controller {...props} render={({ field }) => renderCheckbox(field)} />
  );
};
