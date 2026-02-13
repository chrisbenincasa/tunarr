import type { TextFieldProps } from '@mui/material';
import { TextField } from '@mui/material';
import type { StandardSchemaV1Issue } from '@tanstack/react-form';
import { head, isObject, isString, partition } from 'lodash-es';
import { useMemo } from 'react';
import { useFieldContext } from '../../hooks/form.ts';

function isStandardSchemaIssue(err: unknown): err is StandardSchemaV1Issue {
  return isObject(err) && 'message' in err && isString(err.message);
}

export function BasicTextInput(props: TextFieldProps) {
  const field = useFieldContext<string>();
  // console.log(field.state.meta.errors);
  const errors = useMemo(() => {
    if (field.state.meta.errors.length === 0) {
      return;
    }
    const [standardIssues, nonStandard] = partition(
      field.state.meta.errors,
      isStandardSchemaIssue,
    );

    const prettyErrors = standardIssues.map((issue) => issue.message);
    const others = nonStandard.map((s) => JSON.stringify(s));
    return head(prettyErrors.concat(others));
  }, [field.state.meta.errors]);
  return (
    <TextField
      {...props}
      value={field.state.value}
      onChange={(e) => field.handleChange(e.target.value)}
      onBlur={() => field.handleBlur()}
      error={field.state.meta.errors.length > 0}
      helperText={
        <>
          {props.helperText}
          {errors}
        </>
      }
    />
  );
}
