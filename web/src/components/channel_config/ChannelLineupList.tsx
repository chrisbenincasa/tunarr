import { useProgramTitleFormatter } from '@/hooks/useProgramTitleFormatter.ts';
import { useSuspendedStore } from '@/hooks/useSuspendedStore.ts';
import { deleteProgram } from '@/store/entityEditor/util.ts';
import {
  Directions,
  Expand,
  MusicVideo,
  VideoCameraBackOutlined,
} from '@mui/icons-material';
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
  useMediaQuery,
  useTheme,
} from '@mui/material';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import { type Channel, type ChannelProgram } from '@tunarr/types';
import Color from 'colorjs.io';
import dayjs, { type Dayjs } from 'dayjs';
import { findIndex, isString, isUndefined, map, maxBy, sumBy } from 'lodash-es';
import React, {
  type CSSProperties,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { useDrag, useDrop } from 'react-dnd';
import {
  FixedSizeList,
  type FixedSizeListProps,
  type ListChildComponentProps,
} from 'react-window';
import { type MarkRequired } from 'ts-essentials';
import { match, P } from 'ts-pattern';
import { getTextContrast } from '../../helpers/colors.ts';
import { channelProgramUniqueId, grayBackground } from '../../helpers/util.ts';
import { useRandomProgramBackgroundColor } from '../../hooks/colorHooks.ts';
import { moveProgramInCurrentChannel } from '../../store/channelEditor/actions.ts';
import useStore, { type State } from '../../store/index.ts';
import { materializedProgramListSelector } from '../../store/selectors.ts';
import {
  type UIChannelProgram,
  type UIFlexProgram,
  type UIRedirectProgram,
} from '../../types/index.ts';
import AddFlexModal from '../programming_controls/AddFlexModal.tsx';
import AddRedirectModal from '../programming_controls/AddRedirectModal.tsx';
import ProgramDetailsDialog from '../programs/ProgramDetailsDialog.tsx';

export type CommonProps = {
  moveProgram?: (originalIndex: number, toIndex: number) => void;
  deleteProgram?: (index: number) => void;
  // If given, the list will be rendered using react-window
  virtualListProps?: Omit<FixedSizeListProps, 'itemCount' | 'children'>;
  enableDnd?: boolean;
  enableRowEdit?: boolean;
  enableRowDelete?: boolean;
  showProgramCount?: boolean;
  showProgramStartTime?: boolean;
  listEmptyMessage?: React.ReactNode;
  listRef?: React.MutableRefObject<HTMLDivElement | null>;
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
  showProgramStartTime?: boolean;
  relativeDuration?: number;
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
  showProgramStartTime,
  relativeDuration,
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

  const handleInfoButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onInfoClicked(program);
  };

  const titleParts = [
    <Box
      component="span"
      sx={{
        maxWidth: '75%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        marginRight: 'auto',
      }}
    >
      {titleFormatter(program)}
    </Box>,
  ];
  const startTimeDate = !isUndefined(program.startTimeOffset)
    ? dayjs(channel.startTime + program.startTimeOffset)
    : undefined;

  const startTime = startTimeDate?.format(smallViewport ? 'L LT' : 'lll');
  if (!smallViewport && showProgramStartTime && startTime) {
    if (startTime) {
      titleParts.push(<Box component="span">{startTime}</Box>);
    }
  }

  let icon: React.ReactElement | null = null;

  if (program.type === 'content' || program.type === 'custom') {
    const underlyingProgram =
      program.type === 'content' ? program : program.program;
    icon = match(underlyingProgram?.subtype)
      .with('movie', () => <TheatersIcon />)
      .with('episode', () => <TvIcon />)
      .with('track', () => <MusicNote />)
      .with('music_video', () => <MusicVideo />)
      .with('other_video', () => <VideoCameraBackOutlined />)
      .with(P.nullish, () => null)
      .exhaustive();
  } else if (program.type === 'flex') {
    icon = <Expand />;
  } else if (program.type === 'redirect') {
    icon = <Directions />;
  }

  if (icon !== null) {
    icon = (
      <ListItemIcon sx={{ color: 'currentcolor', minWidth: 0, pr: 1 }}>
        {icon}
      </ListItemIcon>
    );
  }

  const bgColorPicker = useRandomProgramBackgroundColor();
  const backgroundColor =
    program.type === 'flex'
      ? new Color(grayBackground(theme.palette.mode))
      : bgColorPicker(program);
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

  return (
    <ListItem
      style={{
        ...(style ?? {}),
        border: enableDrag
          ? isDragging
            ? '1px dashed gray'
            : undefined
          : undefined,
        cursor: enableDrag ? (isDragging ? 'grabbing' : 'grab') : 'default',
      }}
      divider
      sx={{
        color: getTextContrast(bgDarker, theme.palette.mode),
        background: bg,
        '&:hover': {
          background: (theme) =>
            isDragging
              ? 'transparent'
              : new Color(
                  backgroundColor
                    .clone()
                    .lighten(theme.palette.mode === 'dark' ? 0.025 : 0.05),
                ).toString({ format: 'hex' }),
        },
        borderBottom: 'thin solid',
        borderBottomColor: new Color(
          backgroundColor.clone().darken(0.2),
        ).toString({
          format: 'hex',
        }),
        pr: enableDelete ? '96px' : undefined,
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
                  sx={{
                    cursor: 'pointer',
                    minWidth: 0,
                    color: 'currentcolor',
                  }}
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
                sx={{ color: 'currentcolor' }}
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
                sx={{ color: 'currentcolor' }}
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
            <ListItemIcon
              sx={{ color: 'currentcolor', width: 24, minWidth: 0, mr: 2 }}
            >
              <DragIndicatorIcon />
            </ListItemIcon>
          )}

          {!smallViewport
            ? (icon ?? <Box sx={{ mr: 1, width: 24, height: '100%' }} />)
            : null}

          <ListItemText
            primary={<>{titleParts}</>}
            secondary={smallViewport ? startTime : null}
            sx={{
              fontStyle: program.persisted ? 'normal' : 'italic',
            }}
            slotProps={{
              primary: {
                sx: {
                  width: '100%',
                  fontSize: '0.875em', // Hack to get dense styles applied for virtualized lists
                  display: 'inline-flex !important', // CSS is a mystery
                },
              },
            }}
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

export default function ChannelLineupList(props: Props) {
  const {
    deleteProgram = defaultProps.deleteProgram,
    moveProgram = defaultProps.moveProgram,
    virtualListProps,
    showProgramCount = defaultProps.showProgramCount,
    enableDnd = defaultProps.enableDnd,
    showProgramStartTime = true,
  } = props;
  const channel = useStore((s) => s.channelEditor.currentEntity);
  // We have to use props.type here to get proper type narrowing
  const selector =
    props.type === 'selector'
      ? (props.programListSelector ?? defaultProps.programListSelector)
      : () => [];
  const storeProgramList = useSuspendedStore(selector);
  const programList =
    props.type === 'selector' ? storeProgramList : props.programList;
  const duration = sumBy(programList, 'duration');
  const [focusedProgramDetails, setFocusedProgramDetails] = useState<
    ChannelProgram | undefined
  >();
  const [guideTime, setStartStop] = useState<GuideTime>({});
  const [editProgram, setEditProgram] = useState<
    ((UIFlexProgram | UIRedirectProgram) & { index: number }) | undefined
  >();

  const maxDuration = useMemo(
    () => maxBy(programList, (p) => (p.type === 'flex' ? 0 : p.duration)),
    [programList],
  );

  const findProgram = useCallback(
    (originalIndex: number) => {
      return { index: findIndex(programList, { originalIndex }) };
    },
    [programList],
  );

  const titleFormatter = useProgramTitleFormatter();

  const openDetailsDialog = useCallback(
    (program: ChannelProgram, startTimeDate?: Date) => {
      if (program.type !== 'content' && program.type !== 'custom') {
        return;
      }

      console.log(program);
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
    const maxDurationMs = maxDuration?.duration ?? 0;
    const relativeDuration =
      maxDurationMs > 0 ? program.duration / maxDurationMs : undefined;

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
        showProgramStartTime={showProgramStartTime}
        relativeDuration={relativeDuration}
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

    const programId =
      focusedProgramDetails?.type === 'custom'
        ? focusedProgramDetails.program?.uniqueId
        : focusedProgramDetails?.type === 'content'
          ? focusedProgramDetails?.id
          : null;

    const programType =
      focusedProgramDetails?.type === 'custom'
        ? focusedProgramDetails.program?.subtype
        : focusedProgramDetails?.type === 'content'
          ? focusedProgramDetails?.subtype
          : null;

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
        <Box ref={props.listRef}>
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
        </Box>
        {focusedProgramDetails && programId && programType && (
          <ProgramDetailsDialog
            open={!isUndefined(focusedProgramDetails)}
            onClose={() => setFocusedProgramDetails(undefined)}
            start={guideTime.start}
            stop={guideTime.stop}
            programId={programId}
            programType={programType}
          />
        )}
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
