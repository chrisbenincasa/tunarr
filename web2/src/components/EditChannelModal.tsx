import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Skeleton,
  Tab,
  Tabs,
  TextField,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Channel, CreateChannelRequest } from 'dizquetv-types';
import React, { useState } from 'react';
import { ChannelProgrammingConfig } from './channel_config/ChannelProgrammingConfig.tsx';

interface CreateChannelModalProps {
  open: boolean;
  onClose: () => void;
  defaultTab?: TabValues;
  channelNumber: number;
  isNew: boolean;
}

interface TabPanelProps {
  children?: React.ReactNode;
  currentValue: TabValues;
  value: TabValues;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, currentValue, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== currentValue}
      id={`simple-tabpanel-${currentValue}`}
      aria-labelledby={`simple-tab-${currentValue}`}
      {...other}
    >
      {value === currentValue && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

type TabValues = 'properties' | 'programming' | 'flex' | 'epg' | 'ffmpeg';

function defaultNewChannel(num: number): Channel {
  return {
    name: `Channel ${num}`,
    number: num,
    startTime: dayjs().unix(),
    duration: 0,
    programs: [],
    icon: {
      duration: 0,
      path: '',
      position: 'bottom',
      width: 0,
    },
    guideMinimumDurationSeconds: 300,
    groupTitle: 'tv',
    stealth: false,
    disableFillerOverlay: false,
    offline: {
      mode: 'pic',
    },
  };
}

export default function CreateChannelModal(props: CreateChannelModalProps) {
  const {
    isPending: channelLoading,
    data: existingChannel,
    error: channelError,
  } = useQuery({
    queryKey: ['channels', props.channelNumber],
    queryFn: async ({ queryKey }) => {
      const res = await fetch(
        `http://localhost:8000/api/channel/${queryKey[1]}`,
      );
      return res.json() as Promise<Channel>;
    },
    enabled: !props.isNew,
  });

  const queryClient = useQueryClient();

  const createChannel = useMutation({
    mutationFn: async (channel: CreateChannelRequest) =>
      await fetch('http://localhost:8000/api/v2/channels', {
        body: JSON.stringify(channel),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        exact: false,
        queryKey: ['channels'],
      });
      props.onClose();
    },
  });

  const onCreateButtonClicked = (channel: Channel) => {
    console.log('CLICK');
    createChannel.mutate({
      ...channel,
    });
  };

  const isEditingExistingChannel = !props.isNew;
  const isLoading = isEditingExistingChannel && channelLoading;
  const channel = isEditingExistingChannel
    ? existingChannel!
    : defaultNewChannel(props.channelNumber);

  const [currentTab, setCurrentTab] = useState<TabValues>(
    props.defaultTab ?? 'properties',
  );

  const handleChange = (_: React.SyntheticEvent, newValue: TabValues) =>
    setCurrentTab(newValue);

  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {isEditingExistingChannel
          ? `Edit Channel ${props.channelNumber}`
          : 'Create A Channel'}
      </DialogTitle>
      {isLoading ? (
        <Skeleton>
          <DialogContent />
        </Skeleton>
      ) : (
        <DialogContent>
          <Box sx={{ borderColor: 'background.paper', borderBottom: 1 }}>
            <Tabs value={currentTab} onChange={handleChange}>
              <Tab value="properties" label="Properties" />
              <Tab value="programming" label="Programming" />
              <Tab value="flex" label="Flex" />
              <Tab value="epg" label="EPG" />
              <Tab value="ffmpeg" label="FFMPEG" />
            </Tabs>
          </Box>
          <TabPanel value="properties" currentValue={currentTab}>
            <TextField
              fullWidth
              label="Channel Number"
              value={channel?.number}
              sx={{ mt: 2, mb: 2 }}
            />
            <TextField fullWidth label="Channel Name" value={channel?.name} />
          </TabPanel>
          <TabPanel value="programming" currentValue={currentTab}>
            <ChannelProgrammingConfig channel={channel} />
          </TabPanel>
          <TabPanel value="flex" currentValue={currentTab}>
            Flex
          </TabPanel>
          <TabPanel value="epg" currentValue={currentTab}>
            EPG
          </TabPanel>
          <TabPanel value="ffmpeg" currentValue={currentTab}>
            FFMPEG
          </TabPanel>
        </DialogContent>
      )}

      <DialogActions>
        <Button onClick={props.onClose}>Cancel</Button>
        <Button onClick={() => onCreateButtonClicked(channel)}>
          {isEditingExistingChannel ? 'Save' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
