import { createFormHook, createFormHookContexts } from '@tanstack/react-form';
import { BasicCheckboxInput } from '../components/form/BasicCheckboxInput.tsx';
import {
  BasicSelectInput,
  SelectInput,
} from '../components/form/BasicSelectInput.tsx';
import { BasicTextInput } from '../components/form/BasicTextInput.tsx';

export const { formContext, fieldContext, useFormContext, useFieldContext } =
  createFormHookContexts();

export const { useAppForm, withForm, useTypedAppFormContext } = createFormHook({
  fieldComponents: {
    BasicSelectInput,
    BasicTextInput,
    SelectInput,
    BasicCheckboxInput,
  },
  formComponents: {},
  fieldContext,
  formContext,
});
