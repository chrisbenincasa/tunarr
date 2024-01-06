import {
  Box,
  Button,
  FormControl,
  Input,
  InputLabel,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import dayjs from 'dayjs';
import { isPlexMovie } from 'dizquetv-types/plex';
import { useState } from 'react';
import { setChannelStartTime } from '../../store/channelEditor/actions.ts';
import { isEphemeralProgram } from '../../store/channelEditor/store.ts';
import useStore from '../../store/index.ts';
import ProgrammingSelector from './ProgrammingSelector.tsx';

export function ChannelProgrammingConfig() {
  const channel = useStore((s) => s.channelEditor.currentChannel);
  const [programmingModalOpen, setProgrammingModalOpen] = useState(false);
  const programList = useStore((s) => s.channelEditor.programList);

  const renderPrograms = () => {
    return programList.map((p) => {
      const startTime = dayjs(p.start).toString();

      if (isEphemeralProgram(p)) {
        let itemTitle: string;
        if (isPlexMovie(p.originalProgram)) {
          itemTitle = p.originalProgram.title;
        } else {
          itemTitle = `${p.originalProgram.grandparentTitle} - ${p.originalProgram.title}`;
        }
        const title = `${startTime} ${itemTitle}`;
        return (
          <ListItem key={p.start}>
            <ListItemText primary={title} sx={{ fontStyle: 'italic' }} />
          </ListItem>
        );
      } else {
        // const title = `${p.title}`
        let title: string = p.title;
        if (p.type === 'flex') {
          title = 'Flex';
        }

        title = `${startTime} ${title}`;

        return (
          <ListItem key={p.start}>
            <ListItemText primary={title} />
          </ListItem>
        );
      }
    });
  };

  const handleStartTimeChange = (value: string) => {
    setChannelStartTime(dayjs(value).unix());
  };

  const startTime = channel ? dayjs(channel.startTime * 1000) : dayjs();
  const endTime = startTime.add(channel?.duration ?? 0, 'milliseconds');

  return (
    <Box display="flex" flexDirection="column">
      <Box display="flex">
        <FormControl margin="normal" sx={{ flex: 1, mr: 2 }}>
          <InputLabel>Programming Start</InputLabel>
          <Input
            type="datetime-local"
            value={startTime.toISOString().replace('Z', '')}
            onChange={(e) => handleStartTimeChange(e.target.value)}
          />
        </FormControl>
        <FormControl margin="normal" sx={{ flex: 1 }}>
          <InputLabel>Programming End</InputLabel>
          <Input
            disabled
            type="datetime-local"
            value={endTime.toISOString().replace('Z', '')}
          />
        </FormControl>
      </Box>
      <Box>
        <Button
          variant="contained"
          onClick={() => setProgrammingModalOpen(true)}
        >
          Add
        </Button>
      </Box>
      <Box display="flex">
        <Box sx={{ flex: 1, maxHeight: 400, overflowY: 'auto' }}>
          <List dense>{renderPrograms()}</List>
        </Box>
      </Box>
      <ProgrammingSelector
        open={programmingModalOpen}
        onClose={() => setProgrammingModalOpen(false)}
      />
    </Box>
  );
}
