import { useProgramTitleFormatter } from '@/hooks/useProgramTitleFormatter.ts';
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
import { Channel, ChannelProgram } from '@tunarr/types';
import dayjs, { Dayjs } from 'dayjs';
import { findIndex, isString, isUndefined, map, sumBy } from 'lodash-es';
import React, { CSSProperties, useCallback, useState } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import {
  FixedSizeList,
  FixedSizeListProps,
  ListChildComponentProps,
} from 'react-window';
import { MarkRequired } from 'ts-essentials';
import { alternateColors, channelProgramUniqueId } from '../../helpers/util.ts';
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

type CommonProps = {
  moveProgram?: (originalIndex: number, toIndex: number) => void;
  deleteProgram?: (index: number) => void;
  // If given, the list will be rendered using react-window
  virtualListProps?: Omit<FixedSizeListProps, 'itemCount' | 'children'>;
  enableDnd?: boolean;
  enableRowEdit?: boolean;
  enableRowDelete?: boolean;
  showProgramCount?: boolean;
  listEmptyMessage?: React.ReactNode;
};

type DirectPassedProgramProps = {
  type: 'direct';
  programList: UIChannelProgram[];
} & CommonProps;

type SelectorBasedProgramListProps = {
  type: 'selector';
  programListSelector?: (s: State) => UIChannelProgram[];
} & CommonProps;

// The caller can pass the list of programs to render, if they don't
// want to render them from state
// Otherwise, we can render programs from state given a selector function
type Props = DirectPassedProgramProps | SelectorBasedProgramListProps;

const defaultProps: MarkRequired<
  SelectorBasedProgramListProps,
  'moveProgram' | 'type' | 'programListSelector' | 'deleteProgram'
> = {
  type: 'selector',
  programListSelector: materializedProgramListSelector,
  moveProgram: moveProgramInCurrentChannel,
  deleteProgram: deleteProgram,
  enableDnd: true,
  showProgramCount: true,
  listEmptyMessage: 'No ',
};

type ListItemProps = {
  index: number;
  program: UIChannelProgram;
  startTimeDate?: Date;
  style?: CSSProperties;
  moveProgram: (id: number, to: number) => void;
  findProgram: (id: number) => { index: number };
  deleteProgram: (index: number) => void;
  enableDrag: boolean;
  enableEdit: boolean;
  enableDelete: boolean;
  onInfoClicked: (program: ChannelProgram) => void;
  onEditClicked: (
    program: (UIFlexProgram | UIRedirectProgram) & { index: number },
  ) => void;
  titleFormatter: (program: ChannelProgram) => string;
  channel: Channel;
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
  moveProgram,
  deleteProgram,
  findProgram,
  enableDrag,
  onInfoClicked,
  onEditClicked,
  enableEdit,
  enableDelete,
  titleFormatter,
  channel,
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

  const startTimeDate = !isUndefined(program.startTimeOffset)
    ? dayjs(channel.startTime + program.startTimeOffset)
    : undefined;

  const startTime = startTimeDate?.format(smallViewport ? 'L LT' : 'lll');

  const handleInfoButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onInfoClicked(program);
  };

  let title = `${titleFormatter(program)}`;
  if (!smallViewport && startTime) {
    title += ` - ${startTime}`;
  }

  let icon: React.ReactElement | null = null;
  const underlyingProgram =
    program.type === 'content'
      ? program
      : program.type === 'custom'
        ? program.program
        : null;

  if (underlyingProgram) {
    switch (underlyingProgram.subtype) {
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
            {!smallViewport ? (
              program.type === 'content' ||
              (program.type === 'custom' && program.program) ? (
                <IconButton
                  edge="end"
                  onClick={handleInfoButtonClick}
                  sx={{ cursor: 'pointer', minWidth: 0 }}
                  size="small"
                >
                  <InfoOutlined />
                </IconButton>
              ) : (
                <Box sx={{ mr: 1, width: 24, height: '100%' }} />
              )
            ) : null}
            {(!smallViewport && enableEdit && program.type === 'flex') ||
            program.type === 'redirect' ? (
              <IconButton
                onClick={() => onEditClicked({ ...program, index })}
                edge="end"
                aria-label="delete"
                size="small"
              >
                <Edit />
              </IconButton>
            ) : null}
            {enableDelete && (
              <IconButton
                onClick={() => deleteProgram(index)}
                edge="end"
                aria-label="delete"
                size="small"
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            )}
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
          {enableDrag && (
            <ListItemIcon sx={{ width: 24, minWidth: 0, mr: 2 }}>
              <DragIndicatorIcon />
            </ListItemIcon>
          )}

          {/* {!smallViewport ? (
            program.type === 'content' ? (
              <ListItemIcon
                onClick={handleInfoButtonClick}
                sx={{ cursor: 'pointer', minWidth: 0, pr: 1 }}
              >
                <InfoOutlined />
              </ListItemIcon>
            ) : (
              <Box sx={{ mr: 1, width: 24, height: '100%' }} />
            )
          ) : null} */}

          {!smallViewport
            ? icon ?? <Box sx={{ mr: 1, width: 24, height: '100%' }} />
            : null}

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

export default function ChannelProgrammingList(props: Props) {
  const {
    deleteProgram = defaultProps.deleteProgram,
    moveProgram = defaultProps.moveProgram,
    virtualListProps,
    showProgramCount = defaultProps.showProgramCount,
    enableDnd = defaultProps.enableDnd,
  } = props;
  const channel = useStore((s) => s.channelEditor.currentEntity);
  // We have to use props.type here to get proper type narrowing
  const selector =
    props.type === 'selector'
      ? props.programListSelector ?? defaultProps.programListSelector
      : () => [];
  const storeProgramList = useSuspendedStore(selector);
  const programList =
    props.type === 'selector' ? storeProgramList : props.programList;
  const duration = sumBy(programList, 'duration');
  const [focusedProgramDetails, setFocusedProgramDetails] = useState<
    ChannelProgram | undefined
  >();
  const [, setStartStop] = useState<GuideTime>({});
  const [editProgram, setEditProgram] = useState<
    ((UIFlexProgram | UIRedirectProgram) & { index: number }) | undefined
  >();

  const findProgram = useCallback(
    (originalIndex: number) => {
      return { index: findIndex(programList, { originalIndex }) };
    },
    [programList],
  );

  const titleFormatter = useProgramTitleFormatter();

  const openDetailsDialog = useCallback(
    (program: ChannelProgram, startTimeDate?: Date) => {
      setFocusedProgramDetails(program);
      const start = dayjs(startTimeDate);
      if (startTimeDate) {
        const stop = start.add(program.duration);
        setStartStop({ start, stop });
      }
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
    return (
      <ProgramListItem
        index={idx}
        program={program}
        style={style}
        channel={channel!}
        moveProgram={moveProgram}
        findProgram={findProgram}
        deleteProgram={deleteProgram}
        enableDrag={!!enableDnd}
        enableDelete={props.enableRowDelete ?? true}
        enableEdit={props.enableRowEdit ?? true}
        onInfoClicked={() => openDetailsDialog(program)}
        onEditClicked={openEditDialog}
        titleFormatter={titleFormatter}
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
      const msg = isString(props.listEmptyMessage) ? (
        <Typography align="center" sx={{ my: 4, fontStyle: 'italic' }}>
          {props.listEmptyMessage}
        </Typography>
      ) : (
        props.listEmptyMessage
      );
      return (
        <Box width={'100%'}>
          {msg ?? (
            <Typography align="center" sx={{ my: 4, fontStyle: 'italic' }}>
              No programming added yet
            </Typography>
          )}
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
            <Typography variant="caption">
              {dayjs.duration(duration).humanize()}
            </Typography>
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
