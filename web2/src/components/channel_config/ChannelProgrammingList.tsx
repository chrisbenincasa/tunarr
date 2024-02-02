import DeleteIcon from '@mui/icons-material/Delete';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import dayjs from 'dayjs';
import useStore, { State } from '../../store/index.ts';
import { CSSProperties, useCallback, useMemo } from 'react';
import { deleteProgram } from '../../store/channelEditor/actions.ts';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import { ChannelProgram } from '@tunarr/types';
import {
  FixedSizeList,
  FixedSizeListProps,
  ListChildComponentProps,
} from 'react-window';
import { map, reduce } from 'lodash-es';

type Props = {
  // The caller can pass the list of programs to render, if they don't
  // want to render them from state
  programList?: ChannelProgram[];
  // Otherwise, we can render programs from state given a selector function
  programListSelector?: (s: State) => ChannelProgram[];
  // If given, the list will be rendered using react-window
  virtualListProps?: Omit<FixedSizeListProps, 'itemCount' | 'children'>;
};

const defaultProps: Props = {
  programListSelector: (s) => s.channelEditor.programList,
};

export default function ChannelProgrammingList({
  programList: passedProgramList,
  programListSelector = defaultProps.programListSelector,
  virtualListProps,
}: Props) {
  const channel = useStore((s) => s.channelEditor.currentEntity);
  const storeProgramList = useStore(programListSelector!);
  const programList = passedProgramList ?? storeProgramList;
  const startTimes = useMemo(() => {
    if (!channel) return [];
    return reduce(
      programList,
      (acc, program, idx) => {
        return [...acc, acc[idx].add(program.duration)];
      },
      [dayjs(channel.startTime)],
    );
  }, [channel, programList]);

  const deleteProgramAtIndex = useCallback((idx: number) => {
    deleteProgram(idx);
  }, []);

  const renderProgram = (idx: number, style?: CSSProperties) => {
    const program = programList[idx];
    // Intl.DateTimeFormat
    const startTime = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(startTimes[idx].toDate());
    const dayBoundary = startTimes[idx + 1].isAfter(startTimes[idx], 'day');
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

    title = `${startTime} ${title} (${dur})`;

    return (
      <ListItem
        style={style}
        key={startTime}
        sx={{ borderBottom: dayBoundary ? '1px dashed black' : null }}
        secondaryAction={
          <IconButton
            onClick={() => deleteProgramAtIndex(idx)}
            edge="end"
            aria-label="delete"
          >
            <DeleteIcon />
          </IconButton>
        }
        component="div"
      >
        <ListItemText
          primary={title}
          sx={{
            fontStyle: program.persisted ? 'normal' : 'italic',
          }}
          primaryTypographyProps={{ sx: { fontSize: '0.875em' } }} // Hack to get dense styles applied for virtualized lists
        />
      </ListItem>
    );
  };

  const renderPrograms = () => {
    return map(programList, (_, idx) => renderProgram(idx));
  };

  const ProgramRow = ({ index, style }: ListChildComponentProps) => {
    return renderProgram(index, style);
  };

  const renderList = () => {
    if (virtualListProps) {
      return (
        <FixedSizeList {...virtualListProps} itemCount={programList.length}>
          {ProgramRow}
        </FixedSizeList>
      );
    } else {
      return (
        <Box sx={{ flex: 1, maxHeight: 400, overflowY: 'auto' }}>
          <List dense>{renderPrograms()}</List>
        </Box>
      );
    }
  };

  return <Box display="flex">{renderList()}</Box>;
}
