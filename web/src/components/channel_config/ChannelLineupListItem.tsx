import type { ListItemProps } from '@mui/material';
import { ListItem, styled } from '@mui/material';
import Color from 'colorjs.io';
import React from 'react';
import { getTextContrast } from '../../helpers/colors.ts';
import type { UIChannelProgram } from '../../types/index.ts';

type Props = {
  enableDrag?: boolean;
  isDragging: boolean;
  program: UIChannelProgram;
  backgroundColor: Color;
  relativeDuration?: number;
  style?: React.CSSProperties;
  indented?: boolean;
  enableDelete?: boolean;
};

export const ChannelLineupListItem = styled(
  (props: ListItemProps & Props) => <ListItem {...props} />,
  {
    shouldForwardProp: (prop) =>
      prop !== 'enableDrag' &&
      prop !== 'isDragging' &&
      prop !== 'program' &&
      prop !== 'backgroundColor' &&
      prop !== 'relativeDuration',
  },
)<Props>(({
  style,
  theme,
  backgroundColor,
  relativeDuration,
  program,
  enableDrag,
  isDragging,
  indented,
  enableDelete,
}) => {
  const relativePct = relativeDuration ? relativeDuration * 100.0 : null;
  const bgHex = backgroundColor.toString({ format: 'hex' });
  const bgDarker = new Color(backgroundColor.clone().darken(0.1));

  let bg: string;
  if (program.type === 'flex') {
    const contrastColor = new Color(backgroundColor.clone().darken(0.05));
    bg = `repeating-linear-gradient(-45deg,
              ${bgHex},
              ${bgHex} 10px,
              ${contrastColor.toString()} 10px,
              ${contrastColor.toString()} 20px)`;
  } else if (relativePct) {
    bg = `linear-gradient(to right, ${bgDarker.display()} 0%, ${bgDarker.display()} ${relativePct}%, ${bgHex} ${relativePct}%, ${bgHex} 100%)`;
  } else {
    bg = bgHex;
  }

  return {
    ...(style ?? {}),
    border: enableDrag
      ? isDragging
        ? '1px dashed gray'
        : undefined
      : undefined,
    cursor: enableDrag ? (isDragging ? 'grabbing' : 'grab') : 'default',
    borderBottom: 'thin solid',
    // [theme.breakpoints.up('sm')]: {
    //   marginLeft: theme.spacing(1),
    //   width: 'auto',
    // },
    color: getTextContrast(bgDarker, theme.palette.mode),
    background: bg,
    '&:hover': {
      background: isDragging
        ? 'transparent'
        : new Color(
            backgroundColor
              .clone()
              .lighten(theme.palette.mode === 'dark' ? 0.025 : 0.05),
          ).toString({ format: 'hex' }),
    },
    borderBottomColor: new Color(backgroundColor.clone().darken(0.2)).toString({
      format: 'hex',
    }),
    paddingRight: enableDelete ? '96px' : undefined,
    ...(indented && {
      paddingLeft: '5em',
      borderLeft: `3px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'}`,
    }),
  };
});
