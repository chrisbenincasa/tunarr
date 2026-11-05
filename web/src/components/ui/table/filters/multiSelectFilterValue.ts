export type MultiSelectFilterValue = string[];

export const toMultiSelectFilterValue = (
  value: unknown,
): MultiSelectFilterValue =>
  Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string')
    : [];

// Turns a multiple Select's value into a filter value. MUI reports a
// comma-joined string when the browser autofills the field. No selection
// clears the filter.
export const fromSelectValue = (
  value: unknown,
): MultiSelectFilterValue | undefined => {
  const selected =
    typeof value === 'string'
      ? value.split(',').filter((v) => v !== '')
      : toMultiSelectFilterValue(value);
  return selected.length > 0 ? selected : undefined;
};
