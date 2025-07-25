import type { TooltipProps } from '@mui/material';
import { Tooltip, styled, tooltipClasses } from '@mui/material';

type ElevatedTooltipProps = TooltipProps & {
  elevation: number;
};
export const ElevatedTooltip = styled(
  ({ className, ...props }: ElevatedTooltipProps) => (
    <Tooltip {...props} classes={{ popper: className }} />
  ),
  {
    shouldForwardProp: (prop) => prop !== 'elevation',
  },
)(({ theme, elevation }) => ({
  [`& .${tooltipClasses.tooltip}`]: {
    // backgroundColor: theme.palette.common.white,
    // color: 'rgba(0, 0, 0, 0.87)',
    boxShadow: theme.shadows[elevation],
    // fontSize: 11,
    margin: '8px 16px',
  },
}));
