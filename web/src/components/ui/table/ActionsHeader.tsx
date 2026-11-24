import { useLingui } from '@lingui/react/macro';
import { Box } from '@mui/material';
import { visuallyHidden } from './sx.ts';

export const ActionsHeader = () => {
  const { t } = useLingui();
  return (
    <Box component="span" sx={visuallyHidden}>
      {t`Actions`}
    </Box>
  );
};
