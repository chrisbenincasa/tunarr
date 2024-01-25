import DeleteIcon from '@mui/icons-material/Delete';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import dayjs from 'dayjs';
import useStore, { State } from '../../store/index.ts';
import { useCallback } from 'react';
import { deleteProgram } from '../../store/channelEditor/actions.ts';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import { ChannelProgram } from '@tunarr/types';

type Props = {
  programList?: ChannelProgram[];
  programListSelector?: (s: State) => ChannelProgram[];
};

const defaultProps: Props = {
  programListSelector: (s) => s.channelEditor.programList,
};

export default function ChannelProgrammingList({
  programList: passedProgramList,
  programListSelector = defaultProps.programListSelector,
}: Props) {
  const channel = useStore((s) => s.channelEditor.currentEntity);
  const storeProgramList = useStore(programListSelector!);
  const programList = passedProgramList ?? storeProgramList;

  const deleteProgramAtIndex = useCallback((idx: number) => {
    deleteProgram(idx);
  }, []);

  const renderPrograms = () => {
    let lastStart = dayjs(channel!.startTime);
    return programList.map((p, idx) => {
      const startTime = lastStart.format('YYYY-MM-DD HH:mm:ss');
      const nextStart = lastStart.add(p.duration, 'milliseconds');
      const dayBoundary = nextStart.isAfter(lastStart, 'day');
      lastStart = nextStart;
      let title: string;

      switch (p.type) {
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
          if (p.episodeTitle) {
            title = `${p.title} - ${p.episodeTitle}`;
          } else {
            title = p.title;
          }
          break;
      }

      const dur = dayjs.duration({ milliseconds: p.duration }).humanize();

      title = `${startTime} ${title} (${dur})`;

      return (
        <ListItem
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
        >
          <ListItemText
            primary={title}
            sx={{ fontStyle: p.persisted ? 'normal' : 'italic' }}
          />
        </ListItem>
      );
    });
  };

  return (
    <Box display="flex">
      <Box sx={{ flex: 1, maxHeight: 400, overflowY: 'auto' }}>
        <List dense>{renderPrograms()}</List>
      </Box>
    </Box>
  );
}
