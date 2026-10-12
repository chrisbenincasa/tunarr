import { styled } from '@mui/material';
import type { TvGuideProgram } from '@tunarr/types';
import Color from 'colorjs.io';
import { isUndefined } from 'lodash-es';
import { alternateColors } from '../../helpers/util.ts';
import { TvGuideGridChild } from './TvGuideGridChild.tsx';

export const TvGuideItem = styled(TvGuideGridChild, {
  shouldForwardProp: (prop) =>
    prop !== 'backgroundColor' &&
    prop !== 'program' &&
    prop !== 'left' &&
    prop !== 'compact',
})<{
  program?: TvGuideProgram;
  backgroundColor?: Color;

  // Percentages of the guide window
  left: number;
  width: number;
  index: number;

  // Too narrow for text. Drops the gap and padding so neighboring slivers
  // stay visible instead of collapsing into their borders.
  compact?: boolean;
}>(({ theme, left, width, index, backgroundColor, program, compact }) => {
  const bgColor =
    backgroundColor?.toString({ format: 'hex' }) ??
    alternateColors(index, theme.palette.mode);
  const bgLighter = new Color(bgColor).set('oklch.l', (l) => l * 1.05);
  const bgDarker = new Color(bgColor).set('oklch.l', (l) => l * 0.95);

  const background =
    isUndefined(program) || program.type === 'flex' || program.isPaused
      ? `repeating-linear-gradient(-45deg,
              ${bgColor},
              ${bgColor} 10px,
              ${bgDarker.toString()} 10px,
              ${bgDarker.toString()} 20px)`
      : bgColor;

  const hoverBackground =
    isUndefined(program) || program.type === 'flex' || program.isPaused
      ? `repeating-linear-gradient(-45deg,
  ${bgLighter.toString()},
  ${bgLighter.toString()} 10px,
  ${bgColor} 10px,
  ${bgColor} 20px)`
      : bgLighter.toString();

  return {
    display: 'flex',
    alignItems: 'flex-start',
    background,

    // Blocks are placed by time. The transparent border draws the gap between
    // neighbors without taking width from the layout.
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: `${left}%`,
    width: `${width}%`,
    boxSizing: 'border-box',
    minWidth: 0,
    backgroundClip: 'padding-box',
    borderStyle: 'solid',
    borderWidth: compact ? '2px 0' : '2px',
    borderColor: 'transparent',
    borderRadius: compact ? 0 : '5px',
    padding: compact ? 0 : '1px 4px',
    boxShadow: compact ? 'inset -1px 0 0 rgba(0, 0, 0, 0.3)' : undefined,
    transition: 'left 0.5s ease-in, width 0.5s ease-in',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    cursor: 'pointer',
    '&:hover': {
      background: hoverBackground,
      // color: getTextContrast(bgLighter, theme.palette.mode),
    },
  };
});
