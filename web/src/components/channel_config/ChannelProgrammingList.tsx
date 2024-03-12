import {
  Delete as DeleteIcon,
  DragIndicator as DragIndicatorIcon,
} from '@mui/icons-material';
import { ListItemIcon, Typography } from '@mui/material';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import { ChannelProgram } from '@tunarr/types';
import dayjs from 'dayjs';
import { findIndex, map } from 'lodash-es';
import { CSSProperties, useCallback } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import {
  FixedSizeList,
  FixedSizeListProps,
  ListChildComponentProps,
} from 'react-window';
import { alternateColors, channelProgramUniqueId } from '../../helpers/util.ts';
import { usePlexServerSettings } from '../../hooks/settingsHooks.ts';
import {
  deleteProgram,
  moveProgramInCurrentChannel,
} from '../../store/channelEditor/actions.ts';
import useStore, { State } from '../../store/index.ts';
import { materializedProgramListSelector } from '../../store/selectors.ts';
import { UIChannelProgram } from '../../types/index.ts';

type Props = {
  // The caller can pass the list of programs to render, if they don't
  // want to render them from state
  programList?: UIChannelProgram[];
  // Otherwise, we can render programs from state given a selector function
  programListSelector?: (s: State) => UIChannelProgram[];
  // If given, the list will be rendered using react-window
  virtualListProps?: Omit<FixedSizeListProps, 'itemCount' | 'children'>;
  enableDnd?: boolean;
};

const defaultProps: Props = {
  programListSelector: materializedProgramListSelector,
  enableDnd: true,
};

type ListItemProps = {
  // originalIndex: number;
  index: number;
  program: ChannelProgram & { originalIndex: number };
  startTimeDate: Date;
  style?: CSSProperties;
  moveProgram: (id: number, to: number) => void;
  findProgram: (id: number) => { index: number };
  enableDrag: boolean;
};

type ListDragItem = {
  originalIndex: number;
  id: number;
  program: ChannelProgram;
};

const ProgramListItem = ({
  style,
  program,
  index,
  startTimeDate,
  moveProgram,
  findProgram,
  enableDrag,
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

  // Intl.DateTimeFormat
  const startTime = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(startTimeDate);

  // const dayBoundary = startTimes[idx + 1].isAfter(startTimes[idx], 'day');
  let title: string;

  switch (program.type) {
    case 'custom':
      title = 'custom...';
      break;
    case 'redirect':
      title = 'redirect...';
      break;
    case 'flex':
      title = 'Flex';
      break;
    case 'content':
      if (program.episodeTitle) {
        title = `${program.title} - ${program.episodeTitle}`;
      } else {
        title = program.title;
      }
      break;
  }

  const dur = dayjs.duration({ milliseconds: program.duration }).humanize();

  title = `${startTime} - ${title} -  (${dur})`;

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
      }}
      key={startTime}
      // sx={{ borderBottom: dayBoundary ? '1px dashed black' : null }}
      secondaryAction={
        enableDrag && isDragging ? (
          false
        ) : (
          <IconButton
            onClick={() => deleteProgram(index)}
            edge="end"
            aria-label="delete"
          >
            <DeleteIcon />
          </IconButton>
        )
      }
      component="div"
      ref={(node) => drag(drop(node))}
    >
      {enableDrag && isDragging ? (
        false
      ) : (
        <>
          <ListItemIcon>
            <DragIndicatorIcon />
          </ListItemIcon>

          <ListItemText
            primary={title}
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

export default function ChannelProgrammingList({
  programList: passedProgramList,
  programListSelector = defaultProps.programListSelector,
  virtualListProps,
  enableDnd = defaultProps.enableDnd,
}: Props) {
  const { data: plexServers } = usePlexServerSettings();
  const channel = useStore((s) => s.channelEditor.currentEntity);
  const storeProgramList = useStore(programListSelector!);
  const programList = passedProgramList ?? storeProgramList;

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
        <Box>
          <Typography
            align="center"
            width={'100%'}
            sx={{ my: 4, fontStyle: 'italic' }}
          >
            No programming added yet
          </Typography>
        </Box>
      );
    }

    if (virtualListProps) {
      return (
        <FixedSizeList
          {...virtualListProps}
          itemCount={programList.length}
          itemKey={itemKey}
          itemData={programList}
        >
          {ProgramRow}
        </FixedSizeList>
      );
    } else {
      return (
        <Box ref={drop} sx={{ flex: 1, maxHeight: 400, overflowY: 'auto' }}>
          <List dense>{renderPrograms()}</List>
        </Box>
      );
    }
  };

  return <Box display="flex">{renderList()}</Box>;
}
