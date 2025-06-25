import { Box, styled } from '@mui/material';
import { isNumber } from 'lodash-es';

export const TvGuideGridChild = styled(Box)<{ width: number | string }>(
  ({ width }) => ({
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderWidth: '0 1px 0 0',
    width: isNumber(width) ? `${width}%` : width,
    transition: 'width 0.5s ease-in',
  }),
);
