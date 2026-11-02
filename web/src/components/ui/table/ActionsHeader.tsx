import { useLingui } from '@lingui/react/macro';
import { Box } from '@mui/material';

const visuallyHidden = {
  position: 'absolute',
  width: '1px',
  height: '1px',
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
