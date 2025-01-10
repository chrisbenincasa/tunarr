import {
  AddProgrammingContext,
  AddProgrammingContextType,
} from '@/types/AddProgrammingContext.ts';
import React from 'react';
import { assert } from 'ts-essentials';

export const useAddProgrammingContext = () => {
  const ctx = React.useContext(AddProgrammingContext);

  if (import.meta.env.DEV) {
    assert(
      !!ctx,
      'Using useAddProgrammingContext outside of a provider context!',
    );
  }

  return ctx as NonNullable<AddProgrammingContextType>;
};
