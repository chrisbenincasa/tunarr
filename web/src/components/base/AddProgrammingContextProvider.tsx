import {
  AddProgrammingContext,
  AddProgrammingContextType,
} from '@/types/AddProgrammingContext.ts';

export const AddProgrammingContextProvider = (
  props: AddProgrammingContextType & {
    children: React.ReactNode | React.ReactNode[];
  },
) => {
  const { children, ...rest } = props;
  return (
    <AddProgrammingContext.Provider value={rest}>
      {children}
    </AddProgrammingContext.Provider>
  );
};
