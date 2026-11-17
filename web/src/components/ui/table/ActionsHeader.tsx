import { useLingui } from '@lingui/react/macro';
import { Box } from '@mui/material';

// Lengths are strings because sx reads a number up to 1 as a fraction, so
// width: 1 would mean 100% and widen the page.
const visuallyHidden = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  margin: '-1px',
  padding: 0,
  border: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const;

export const ActionsHeader = () => {
  const { t } = useLingui();
  return (
    <Box component="span" sx={visuallyHidden}>
      {t`Actions`}
    </Box>
  );
};
