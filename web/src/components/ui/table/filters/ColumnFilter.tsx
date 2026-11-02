import type { RowData } from '@tanstack/react-table';
import type { TunarrColumn } from '../tunarrTable.ts';
import { BooleanFilter } from './BooleanFilter.tsx';
import { RangeFilter } from './RangeFilter.tsx';
import { TextFilter } from './TextFilter.tsx';

export const ColumnFilter = <TData extends RowData>({
  column,
}: {
  column: TunarrColumn<TData>;
}) => {
  switch (column.columnDef.meta?.filterVariant ?? 'text') {
    case 'range':
      return <RangeFilter column={column} />;
    case 'boolean':
      return <BooleanFilter column={column} />;
    case 'text':
      return <TextFilter column={column} />;
  }
};
