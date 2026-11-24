import { useLingui } from '@lingui/react/macro';
import { ChevronRight } from '@mui/icons-material';
import { Box, IconButton } from '@mui/material';
import type { Row, RowData } from '@tanstack/react-table';
import { visuallyHidden } from './sx.ts';
import type { TunarrFeatures } from './tunarrTable.ts';

export const ExpandHeader = () => {
  const { t } = useLingui();
  return (
    <Box component="span" sx={visuallyHidden}>
      {t`Details`}
    </Box>
  );
};

export const ExpandRowButton = <TData extends RowData>({
  row,
  label,
}: {
  row: Row<TunarrFeatures, TData>;
  label: string;
}) => {
  const { t } = useLingui();
  const expanded = row.getIsExpanded();
  return (
    <IconButton
      size="small"
      aria-expanded={expanded}
      aria-label={
        expanded ? t`Hide details for ${label}` : t`Show details for ${label}`
      }
      disabled={!row.getCanExpand()}
      onClick={() => row.toggleExpanded()}
      sx={{ p: 0.5 }}
    >
      <ChevronRight
        fontSize="small"
        sx={{
          transition: 'transform 150ms',
          transform: expanded ? 'rotate(90deg)' : undefined,
        }}
      />
    </IconButton>
  );
};
