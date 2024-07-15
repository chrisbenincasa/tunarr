import { useSuspendedStore } from '@/hooks/useSuspendedStore.ts';
import { deleteProgram } from '@/store/entityEditor/util.ts';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import Edit from '@mui/icons-material/Edit';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import MusicNote from '@mui/icons-material/MusicNote';
import TheatersIcon from '@mui/icons-material/Theaters';
import TvIcon from '@mui/icons-material/Tv';
import {
  ListItemIcon,
  Typography,
  lighten,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import { forProgramType } from '@tunarr/shared/util';
import { ChannelProgram } from '@tunarr/types';
import dayjs, { Dayjs } from 'dayjs';
import { findIndex, isUndefined, join, map, negate, reject } from 'lodash-es';
import { CSSProperties, useCallback, useState } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import {
  FixedSizeList,
  FixedSizeListProps,
  ListChildComponentProps,
} from 'react-window';
import { betterHumanize } from '../../helpers/dayjs.ts';
import {
  alternateColors,
  channelProgramUniqueId,
  isNonEmptyString,
} from '../../helpers/util.ts';
import { moveProgramInCurrentChannel } from '../../store/channelEditor/actions.ts';
import useStore, { State } from '../../store/index.ts';
import { materializedProgramListSelector } from '../../store/selectors.ts';
import {
  UIChannelProgram,
  UIFlexProgram,
  UIRedirectProgram,
} from '../../types/index.ts';
import ProgramDetailsDialog from '../ProgramDetailsDialog.tsx';
import AddFlexModal from '../programming_controls/AddFlexModal.tsx';
import AddRedirectModal from '../programming_controls/AddRedirectModal.tsx';

const ListItemTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const MobileListItemTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'short',
  timeStyle: 'short',
});

type Props = {
  // The caller can pass the list of programs to render, if they don't
  // want to render them from state
  programList?: UIChannelProgram[];
  // Otherwise, we can render programs from state given a selector function
  programListSelector?: (s: State) => UIChannelProgram[];
  // If given, the list will be rendered using react-window
  virtualListProps?: Omit<FixedSizeListProps, 'itemCount' | 'children'>;
  enableDnd?: boolean;
  showProgramCount?: boolean;
};

const defaultProps: Props = {
  programListSelector: materializedProgramListSelector,
  enableDnd: true,
  showProgramCount: true,
};

type ListItemProps = {
  // originalIndex: number;
  index: number;
  program: UIChannelProgram;
  startTimeDate: Date;
  style?: CSSProperties;
  moveProgram: (id: number, to: number) => void;
  findProgram: (id: number) => { index: number };
  enableDrag: boolean;
  onInfoClicked: (program: ChannelProgram) => void;
  onEditClicked: (
    program: (UIFlexProgram | UIRedirectProgram) & { index: number },
  ) => void;
};

type ListDragItem = {
  originalIndex: number;
  id: number;
  program: ChannelProgram;
};

const programListItemTitleFormatter = (() => {
  const itemTitle = forProgramType({
    custom: () => `Custom Show - `,
    redirect: (p) => `Redirect to "${p.channelName}"`,
    flex: 'Flex',
    content: (p) => {
      switch (p.subtype) {
        case 'movie':
          return p.title;
        case 'episode': {
          // TODO: this makes some assumptions about number of seasons
          // and episodes... it may break
          const epPart =
            p.seasonNumber && p.episodeNumber
              ? ` S${p.seasonNumber
                  .toString()
                  .padStart(2, '0')}E${p.episodeNumber
                  .toString()
                  .padStart(2, '0')}`
              : '';
          return p.episodeTitle
            ? `${p.title}${epPart} - ${p.episodeTitle}`
            : p.title;
        }
        case 'track': {
          return join(
            reject(
              [p.artistName, p.albumName, p.title],
              negate(isNonEmptyString),
            ),
            ' - ',
          );
        }
      }
    },
  });

  return (program: ChannelProgram) => {
    let title = itemTitle(program);

    if (program.type === 'custom' && program.program) {
      title += ` ${itemTitle(program.program)}`;
    }
    const dur = betterHumanize(
      dayjs.duration({ milliseconds: program.duration }),
      { exact: true },
    );

    return `${title} - (${dur})`;
  };
})();

const ProgramListItem = ({
  style,
  program,
  index,
  startTimeDate,
  moveProgram,
  findProgram,
  enableDrag,
  onInfoClicked,
  onEditClicked,
}: ListItemProps) => {
  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: 'Program',
      item: { id: program.originalIndex, originalIndex: program.originalIndex },
      canDrag: () => enableDrag,
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
      isDragging: (monitor) => program.originalIndex === monitor.getItem().id,
      end: (item, monitor) => {
        const { id: droppedId, originalIndex } = item;
        const didDrop = monitor.didDrop();
        // Revert any changes
        if (!didDrop) {
          moveProgram(droppedId, originalIndex);
        }
      },
    }),
    [],
  );

  const [, drop] = useDrop(() => ({
    accept: 'Program',
    hover: ({ id: draggedId }: ListDragItem) => {
      if (draggedId !== program.originalIndex) {
        moveProgram(draggedId, findProgram(program.originalIndex).index);
      }
    },
  }));

  const theme = useTheme();
  const smallViewport = useMediaQuery(theme.breakpoints.down('sm'));

  const startTime = smallViewport
    ? MobileListItemTimeFormatter.format(startTimeDate)
    : ListItemTimeFormatter.format(startTimeDate);
  // console.log(ListItemTimeFormatter.formatToParts(startTimeDate));

  const handleInfoButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onInfoClicked(program);
  };

  // const dayBoundary = startTimes[idx + 1].isAfter(startTimes[idx], 'day');

  let title = `${programListItemTitleFormatter(program)}`;
  if (!smallViewport) {
    title += ` - ${startTime}`;
  }

  let icon: React.ReactElement | null = null;
  if (program.type === 'content') {
    switch (program.subtype) {
      case 'movie':
        icon = <TheatersIcon />;
        break;
      case 'episode':
        icon = <TvIcon />;
        break;
      case 'track':
        icon = <MusicNote />;
        break;
    }
  }
  if (icon !== null) {
    icon = <ListItemIcon sx={{ minWidth: 0, pr: 1 }}>{icon}</ListItemIcon>;
  }

  return (
    <ListItem
      style={{
        ...(style ?? {}),
        border: enableDrag
          ? isDragging
            ? '1px dashed gray'
            : 'transparent'
          : 'transparent',
        cursor: enableDrag ? (isDragging ? 'grabbing' : 'grab') : 'default',
      }}
      sx={{
        backgroundColor: (theme) =>
          isDragging
            ? 'transparent'
            : alternateColors(index, theme.palette.mode, theme),
        '&:hover': {
          backgroundColor: (theme) =>
            isDragging
              ? 'transparent'
              : lighten(
                  alternateColors(index, theme.palette.mode, theme),
                  0.05,
                ),
        },
      }}
      key={startTime}
      secondaryAction={
        enableDrag && isDragging ? null : (
          <>
            {(!smallViewport && program.type === 'flex') ||
            program.type === 'redirect' ? (
              <IconButton
                onClick={() => onEditClicked({ ...program, index })}
                edge="end"
                aria-label="delete"
              >
                <Edit />
              </IconButton>
            ) : null}
            <IconButton
              onClick={() => deleteProgram(index)}
              edge="end"
              aria-label="delete"
              size="small"
              sx={{ maxHeight: '25px' }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </>
        )
      }
      component="div"
      ref={(node) => drag(drop(node))}
    >
      {enableDrag && isDragging ? (
        false
      ) : (
        <>
          <ListItemIcon
            sx={{
              minWidth: smallViewport || program.type === 'content' ? 35 : null,
            }}
          >
            <DragIndicatorIcon />
          </ListItemIcon>

          {!smallViewport ? (
            program.type === 'content' ? (
              <ListItemIcon
                onClick={handleInfoButtonClick}
                sx={{ cursor: 'pointer', minWidth: 0, pr: 1 }}
              >
                <InfoOutlined />
              </ListItemIcon>
            ) : (
              <Box sx={{ pr: 1, width: 20 }} />
            )
          ) : null}

          {!smallViewport ? icon ?? <Box sx={{ pr: 1, width: 20 }} /> : null}

          <ListItemText
            primary={title}
            secondary={smallViewport ? startTime : null}
            sx={{
              fontStyle: program.persisted ? 'normal' : 'italic',
            }}
            primaryTypographyProps={{ sx: { fontSize: '0.875em' } }} // Hack to get dense styles applied for virtualized lists
          />
        </>
      )}
    </ListItem>
  );
};

type GuideTime = {
  start?: Dayjs;
  stop?: Dayjs;
};

export default function ChannelProgrammingList({
  programList: passedProgramList,
  programListSelector = defaultProps.programListSelector,
  virtualListProps,
  showProgramCount = defaultProps.showProgramCount,
  enableDnd = defaultProps.enableDnd,
}: Props) {
  const channel = useStore((s) => s.channelEditor.currentEntity);
  const storeProgramList = useSuspendedStore(programListSelector!);
  const programList = passedProgramList ?? storeProgramList;
  const [focusedProgramDetails, setFocusedProgramDetails] = useState<
    ChannelProgram | undefined
  >();
  const [startStop, setStartStop] = useState<GuideTime>({});
  const [editProgram, setEditProgram] = useState<
    ((UIFlexProgram | UIRedirectProgram) & { index: number }) | undefined
  >();

  const findProgram = useCallback(
    (originalIndex: number) => {
      return { index: findIndex(programList, { originalIndex }) };
    },
    [programList],
  );

  const moveProgram = useCallback(
    (originalIndex: number, toIndex: number) => {
      if (passedProgramList) {
        // Not sure if this works right or what
        const currIndex = findIndex(passedProgramList, { originalIndex });
        if (currIndex >= 0) {
          const items = passedProgramList.splice(currIndex, 1);
          passedProgramList.splice(toIndex, 1, ...items);
        }
      } else {
        moveProgramInCurrentChannel(originalIndex, toIndex);
      }
    },
    [passedProgramList],
  );

  const openDetailsDialog = useCallback(
    (program: ChannelProgram, startTimeDate: Date) => {
      setFocusedProgramDetails(program);
      const start = dayjs(startTimeDate);
      const stop = start.add(program.duration);
      setStartStop({ start, stop });
    },
    [],
  );

  const openEditDialog = useCallback(
    (program: (UIFlexProgram | UIRedirectProgram) & { index: number }) => {
      setEditProgram(program);
    },
    [],
  );

  const [, drop] = useDrop(() => ({ accept: 'Program' }));

  const renderProgram = (idx: number, style?: CSSProperties) => {
    const program = programList[idx];
    const startTimeDate = dayjs(
      channel!.startTime + program.startTimeOffset,
    ).toDate();
    return (
      <ProgramListItem
        index={idx}
        program={program}
        style={style}
        startTimeDate={startTimeDate}
        moveProgram={moveProgram}
        findProgram={findProgram}
        enableDrag={!!enableDnd}
        onInfoClicked={() => openDetailsDialog(program, startTimeDate)}
        onEditClicked={openEditDialog}
      />
    );
  };

  const renderPrograms = () => {
    return map(programList, (_, idx) => renderProgram(idx));
  };

  const ProgramRow = ({ index, style }: ListChildComponentProps) => {
    return renderProgram(index, style);
  };

  const renderList = () => {
    function itemKey(index: number, data: UIChannelProgram[]) {
      // Find the item at the specified index.
      // In this case "data" is an Array that was passed to List as "itemData".

      const item = data[index];

      // Return a value that uniquely identifies this item.
      // Typically this will be a UID of some sort.
      const key =
        item.type != 'flex'
          ? channelProgramUniqueId(item)
          : `flex-${item.originalIndex}`;

      return `${key}_${item.startTimeOffset}`;
    }

    if (programList.length === 0) {
      return (
        <Box width={'100%'}>
          <Typography align="center" sx={{ my: 4, fontStyle: 'italic' }}>
            No programming added yet
          </Typography>
        </Box>
      );
    }

    return (
      <Box width="100%">
        {showProgramCount && (
          <Box sx={{ width: '100%', mb: 1, textAlign: 'right' }}>
            <Typography variant="caption" sx={{ flexGrow: 1, mr: 2 }}>
              {programList.length} program{programList.length === 1 ? '' : 's'}
            </Typography>
            {channel?.duration && (
              <Typography variant="caption">
                {dayjs.duration(channel.duration).humanize()}
              </Typography>
            )}
          </Box>
        )}
        {virtualListProps ? (
          <FixedSizeList
            {...virtualListProps}
            itemCount={programList.length}
            itemKey={itemKey}
            itemData={programList}
          >
            {ProgramRow}
          </FixedSizeList>
        ) : (
          <Box ref={drop} sx={{ flex: 1, maxHeight: 600, overflowY: 'auto' }}>
            <List dense>{renderPrograms()}</List>
          </Box>
        )}
        <ProgramDetailsDialog
          open={!isUndefined(focusedProgramDetails)}
          onClose={() => setFocusedProgramDetails(undefined)}
          program={focusedProgramDetails}
          start={startStop.start}
          stop={startStop.stop}
        />
        <AddFlexModal
          open={!isUndefined(editProgram) && editProgram.type === 'flex'}
          onClose={() => setEditProgram(undefined)}
          initialProgram={
            editProgram?.type === 'flex' ? editProgram : undefined
          }
        />
        <AddRedirectModal
          open={!isUndefined(editProgram) && editProgram.type === 'redirect'}
          onClose={() => setEditProgram(undefined)}
          initialProgram={
            editProgram?.type === 'redirect' ? editProgram : undefined
          }
        />
      </Box>
    );
  };

  return <Box display="flex">{renderList()}</Box>;
}
