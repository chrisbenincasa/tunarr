import { ExpandLess, ExpandMore } from '@mui/icons-material';
import {
  Chip,
  ListItem,
  ListItemText,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import type { Channel, ChannelProgram } from '@tunarr/types';
import Color from 'colorjs.io';
import dayjs from 'dayjs';
import { isUndefined } from 'lodash-es';
import { useMemo, type CSSProperties } from 'react';
import { getTextContrast } from '../../helpers/colors.ts';
import type { MidRollGroup } from '../../helpers/midRollGrouping.ts';
import { grayBackground } from '../../helpers/util.ts';
import { useChannelListItemIcon } from '../../hooks/channel_config/useChannelItemIcon.tsx';
import { useRandomProgramBackgroundColor } from '../../hooks/colorHooks.ts';

type Props = {
  group: MidRollGroup;
  expanded: boolean;
  onToggle: () => void;
  style?: CSSProperties;
  titleFormatter: (program: ChannelProgram) => string;
  channel: Channel;
  showProgramStartTime?: boolean;
};

export function MidRollGroupRow({
  group,
  expanded,
  onToggle,
  style,
  titleFormatter,
  channel,
  showProgramStartTime,
}: Props) {
  const theme = useTheme();
  const smallViewport = useMediaQuery(theme.breakpoints.down('sm'));
  const { parentProgram } = group;

  const icon = useChannelListItemIcon(parentProgram);

  const displayProgram = {
    ...parentProgram,
    duration: group.totalDuration,
    startOffsetMs: undefined,
  } as ChannelProgram;
  const title = titleFormatter(displayProgram);

  const startTimeDate = !isUndefined(group.startTimeOffset)
    ? dayjs(channel.startTime + group.startTimeOffset)
    : undefined;
  const startTime = startTimeDate?.format('L LT');

  const titleParts = [
    <Box
      component="span"
      key="title"
      sx={{
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {title}
    </Box>,
    <Chip
      key="breaks"
      label={`${group.breakCount} break${group.breakCount !== 1 ? 's' : ''}`}
      size="small"
      variant="outlined"
      sx={{
        ml: 1,
        height: 20,
        color: 'currentcolor',
        borderColor: 'currentcolor',
        opacity: 0.8,
        '& .MuiChip-label': { px: 1, fontSize: '0.7rem' },
      }}
    />,
  ];

  if (!smallViewport && showProgramStartTime && startTime) {
    titleParts.push(
      <Box component="span" key="time" sx={{ ml: 'auto', flexShrink: 0 }}>
        {startTime}
      </Box>,
    );
  }

  const bgColorPicker = useRandomProgramBackgroundColor();
  const backgroundColor =
    parentProgram.type === 'flex'
      ? new Color(grayBackground(theme.palette.mode))
      : bgColorPicker(parentProgram);
  const bgHex = backgroundColor.toString({ format: 'hex' });
  const bgDarker = new Color(backgroundColor.clone().darken(0.1));

  const segmentBarParts = useMemo(() => {
    const segmentBarParts: Array<{ fraction: number; isFiller: boolean }> = [];
    for (let i = 0; i < group.items.length; i++) {
      const item = group.items[i];
      const isFiller = item.type === 'filler';
      let totalFraction = 0;
      if (isFiller) {
        for (let j = i; j < group.items.length; j++) {
          const nextItem = group.items[j];
          if (nextItem.type !== 'filler') {
            // Continue the outer loop at this item.
            i = j - 1;
            break;
          }
          totalFraction += nextItem.duration / group.totalDuration;
        }
        segmentBarParts.push({
          fraction: totalFraction,
          isFiller: true,
        });
      } else {
        segmentBarParts.push({
          fraction: item.duration / group.totalDuration,
          isFiller,
        });
      }
    }
    return segmentBarParts;
  }, [group.items, group.totalDuration]);
  return (
    <ListItem
      style={style}
      divider
      sx={{
        color: getTextContrast(bgDarker, theme.palette.mode),
        background: bgHex,
        '&:hover': {
          background: new Color(
            backgroundColor
              .clone()
              .lighten(theme.palette.mode === 'dark' ? 0.025 : 0.05),
          ).toString({ format: 'hex' }),
        },
        borderBottom: 'thin solid',
        borderBottomColor: new Color(
          backgroundColor.clone().darken(0.2),
        ).toString({ format: 'hex' }),
        cursor: 'pointer',
        position: 'relative',
        pr: '48px',
      }}
      onClick={onToggle}
      secondaryAction={
        <IconButton
          edge="end"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          size="small"
          sx={{ color: 'currentcolor' }}
        >
          {expanded ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
      }
      component="div"
    >
      {!smallViewport
        ? (icon ?? <Box sx={{ mr: 1, width: 24, height: '100%' }} />)
        : null}
      <ListItemText
        primary={
          <Box
            component="span"
            sx={{ display: 'inline-flex', width: '100%', gap: 1 }}
          >
            {titleParts}
          </Box>
        }
        secondary={smallViewport ? startTime : null}
        slotProps={{
          primary: {
            sx: {
              width: '100%',
              fontSize: '0.875em',
              display: 'inline-flex !important',
              alignItems: 'center',
            },
          },
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          height: 3,
        }}
      >
        {segmentBarParts.map((part, idx) => (
          <Box
            key={idx}
            sx={{
              flex: part.fraction,
              backgroundColor: part.isFiller
                ? new Color(backgroundColor.clone().darken(0.3)).toString({
                    format: 'hex',
                  })
                : new Color(backgroundColor.clone().lighten(0.15)).toString({
                    format: 'hex',
                  }),
            }}
          />
        ))}
      </Box>
    </ListItem>
  );
}
