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
import { Program } from 'dizquetv-types';

interface ChannelProgrammingConfigProps {
  channel: number;
}

export function ChannelProgrammingConfig(props: ChannelProgrammingConfigProps) {
  const [programmingModalOpen, setProgrammingModalOpen] = useState(false);
  const { isPending, data: programs } = useQuery({
    queryKey: ['channels', 'programming', props.channel],
    queryFn: async () => {
      const res = await fetch(
        `http://localhost:8000/api/v2/channels/${props.channel}/programs`,
      );
      return res.json() as Promise<Program[]>;
    },
  });

  const renderPrograms = () => {
    return programs?.map((p) => (
      <ListItem key={p.key}>
        <ListItemText primary={p.title} />
      </ListItem>
    ));
  };

  return (
    <Box>
      <FormControl>
        <Input type="date" />
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
      <Dialog
        open={programmingModalOpen}
        onClose={() => setProgrammingModalOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <ProgrammingSelector />
      </Dialog>
    </Box>
  );
}
