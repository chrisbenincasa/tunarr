export type DropdownOption<T extends string | number> = {
  value: T;
  description: string;
  helperText?: string;
  disabled?: boolean;
};
