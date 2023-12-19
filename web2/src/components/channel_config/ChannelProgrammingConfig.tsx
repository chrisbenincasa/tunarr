import {
  Box,
  Button,
  Dialog,
  FormControl,
  Input,
  List,
  ListItem,
  ListItemText,
  Skeleton,
} from '@mui/material';
import { useState } from 'react';
import ProgrammingSelector from './ProgrammingSelector.tsx';
import { useQuery } from '@tanstack/react-query';
import { Channel, Program } from 'dizquetv-types';
import dayjs from 'dayjs';
import { useChannelLineup } from '../../hooks/useChannelLineup.ts';

interface ChannelProgrammingConfigProps {
  channel: Channel;
  isNew: boolean;
}

export function ChannelProgrammingConfig(props: ChannelProgrammingConfigProps) {
  const [programmingModalOpen, setProgrammingModalOpen] = useState(false);
  const { isPending, data: programs } = useQuery({
    queryKey: ['channels', 'programming', props.channel.number],
    queryFn: async () => {
      const res = await fetch(
        `http://localhost:8000/api/v2/channels/${props.channel.number}/programs`,
      );
      return res.json() as Promise<Program[]>;
    },
  });

  const {
    isPending: channelLineupLoading,
    data: channelLineup,
    error: channelLineupError,
  } = useChannelLineup(props.channel.number, !props.isNew);

  console.log(channelLineup);

  const renderPrograms = () => {
    return programs?.map((p) => (
      <ListItem key={p.key}>
        <ListItemText primary={p.title} />
      </ListItem>
    ));
  };

  // HACK
  const dt = dayjs(props.channel.startTime).toISOString().replace('Z', '');

  return (
    <Box>
      <FormControl>
        <Input type="datetime-local" value={dt} />
      </FormControl>

      <Button variant="contained" onClick={() => setProgrammingModalOpen(true)}>
        Add
      </Button>
      <Box display="flex">
        <Box sx={{ maxHeight: 400, overflowY: 'scroll' }}>
          {isPending ? (
            <Skeleton>
              <List />
            </Skeleton>
          ) : (
            <List dense>{renderPrograms()}</List>
          )}
        </Box>
      </Box>
      <ProgrammingSelector
        open={programmingModalOpen}
        onClose={() => setProgrammingModalOpen(false)}
      />
    </Box>
  );
}
