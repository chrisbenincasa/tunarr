import {
  Box,
  Button,
  FormControl,
  Input,
  List,
  ListItem,
  ListItemText,
  Skeleton,
} from '@mui/material';
import dayjs from 'dayjs';
import { Channel } from 'dizquetv-types';
import { useEffect, useState } from 'react';
import { useChannelLineup } from '../../hooks/useChannelLineup.ts';
import ProgrammingSelector from './ProgrammingSelector.tsx';
import useStore from '../../store/index.ts';
import { addProgramsToCurrentChannel } from '../../store/channelEditor/actions.ts';

interface ChannelProgrammingConfigProps {
  channel: Channel;
  isNew: boolean;
}

export function ChannelProgrammingConfig(props: ChannelProgrammingConfigProps) {
  const [programmingModalOpen, setProgrammingModalOpen] = useState(false);
  // const { isPending, data: programs } = useQuery({
  //   queryKey: ['channels', 'programming', props.channel.number],
  //   queryFn: async () => {
  //     const res = await fetch(
  //       `http://localhost:8000/api/v2/channels/${props.channel.number}/programs`,
  //     );
  //     return res.json() as Promise<Program[]>;
  //   },
  // });

  const { isPending: channelLineupLoading, data: channelLineup } =
    useChannelLineup(props.channel.number, !props.isNew);

  const programList = useStore((s) => s.channelEditor.programList);

  console.log(programList);

  const renderPrograms = () => {
    return channelLineup?.programs?.map((p) => {
      // const title = `${p.title}`
      let title: string = p.title;
      if (p.type === 'flex') {
        title = 'Flex';
      }

      title = `${p.start} ${title}`;

      return (
        <ListItem key={p.start}>
          <ListItemText primary={title} />
        </ListItem>
      );
    });
  };

  useEffect(() => {
    if (channelLineup) {
      addProgramsToCurrentChannel(channelLineup.programs);
    }
  }, [channelLineup]);

  // HACK
  const dt = dayjs(props.channel.startTime).toISOString().replace('Z', '');

  return (
    <Box display="flex" flexDirection="column">
      <Box>
        <FormControl>
          <Input type="datetime-local" value={dt} />
        </FormControl>

        <Button
          variant="contained"
          onClick={() => setProgrammingModalOpen(true)}
        >
          Add
        </Button>
      </Box>
      <Box display="flex">
        <Box sx={{ flex: 1, maxHeight: 400, overflowY: 'auto' }}>
          {channelLineupLoading ? (
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
