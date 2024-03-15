import {
  Delete as DeleteIcon,
  DragIndicator as DragIndicatorIcon,
  InfoOutlined,
} from '@mui/icons-material';
import { ListItemIcon, Typography } from '@mui/material';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import { forProgramType } from '@tunarr/shared/util';
import { ChannelProgram } from '@tunarr/types';
import dayjs from 'dayjs';
import { findIndex, isUndefined, map } from 'lodash-es';
import { CSSProperties, useCallback, useState } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import {
  FixedSizeList,
  FixedSizeListProps,
  ListChildComponentProps,
} from 'react-window';
import { alternateColors, channelProgramUniqueId } from '../../helpers/util.ts';
import {
  deleteProgram,
  moveProgramInCurrentChannel,
} from '../../store/channelEditor/actions.ts';
import useStore, { State } from '../../store/index.ts';
import { materializedProgramListSelector } from '../../store/selectors.ts';
import { UIChannelProgram } from '../../types/index.ts';
import ProgramDetailsDialog from '../ProgramDetailsDialog.tsx';

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
  onInfoClicked: (program: ChannelProgram) => void;
};

type ListDragItem = {
  originalIndex: number;
  id: number;
  program: ChannelProgram;
};

const programListItemTitleFormatter = (() => {
  const itemTitle = forProgramType({
    custom: 'Custom Show',
    redirect: (p) => `Redirect to Channel ${p.channel}`,
    flex: 'Flex',
    content: (p) => {
      if (p.episodeTitle) {
        return `${p.title} - ${p.episodeTitle}`;
      } else {
        return p.title;
      }
    },
  });

  return (program: ChannelProgram) => {
    const title = itemTitle(program);
    const dur = dayjs.duration({ milliseconds: program.duration }).humanize();
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

  const handleInfoButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log(program);
    onInfoClicked(program);
  };

  // const dayBoundary = startTimes[idx + 1].isAfter(startTimes[idx], 'day');

  const title = `${startTime} - ${programListItemTitleFormatter(program)}`;

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
          {program.type === 'content' && (
            <ListItemIcon
              onClick={handleInfoButtonClick}
              sx={{ cursor: 'pointer' }}
            >
              <InfoOutlined />
            </ListItemIcon>
          )}
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
  const channel = useStore((s) => s.channelEditor.currentEntity);
  const storeProgramList = useStore(programListSelector!);
  const programList = passedProgramList ?? storeProgramList;
  const [focusedProgramDetails, setFocusedProgramDetails] = useState<
    ChannelProgram | undefined
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
    (program: ChannelProgram) => {
      setFocusedProgramDetails(program);
    },
    [setFocusedProgramDetails],
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
        onInfoClicked={openDetailsDialog}
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

    return (
      <>
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
          <Box ref={drop} sx={{ flex: 1, maxHeight: 400, overflowY: 'auto' }}>
            <List dense>{renderPrograms()}</List>
          </Box>
        )}
        <ProgramDetailsDialog
          open={!isUndefined(focusedProgramDetails)}
          onClose={() => setFocusedProgramDetails(undefined)}
          program={focusedProgramDetails}
        />
      </>
    );
  };

  return <Box display="flex">{renderList()}</Box>;
}
