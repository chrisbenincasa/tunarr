import { styled } from '@mui/material';
import type { TvGuideProgram } from '@tunarr/types';
import Color from 'colorjs.io';
import { isNumber, isUndefined } from 'lodash-es';
import { alternateColors } from '../../helpers/util.ts';
import { TvGuideGridChild } from './TvGuideGridChild.tsx';

export const TvGuideItem = styled(TvGuideGridChild, {
  shouldForwardProp: (prop) => prop !== 'backgroundColor' && prop !== 'program',
})<{
  program?: TvGuideProgram;
  backgroundColor?: Color;
  width: number | string;
  index: number;
}>(({ theme, width, index, backgroundColor, program }) => {
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
    borderCollapse: 'collapse',
    borderStyle: 'solid',
    borderWidth: '2px 5px 2px 5px',
    borderColor: 'transparent',
    borderRadius: '5px',
    margin: 1,
    padding: 1,
    height: '4rem',
    width: isNumber(width) ? `${width}%` : width,
    transition: 'width 0.5s ease-in',
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
