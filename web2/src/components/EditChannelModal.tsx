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
} from '@mui/material';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Channel, UpdateChannelRequest } from 'dizquetv-types';
import React, { useEffect, useState } from 'react';
import { apiClient } from '../external/api.ts';
import { setCurrentChannel } from '../store/channelEditor/actions.ts';
import ChannelEpgConfig from './channel_config/ChannelEpgConfig.tsx';
import { ChannelFlexConfig } from './channel_config/ChannelFlexConfig.tsx';
import ChannelPropertiesEditor from './channel_config/ChannelPropertiesEditor.tsx';
import ChannelTranscodingConfig from './channel_config/ChannelTranscodingConfig.tsx';
import { useChannelAndLineup } from '../hooks/useChannelLineup.ts';

interface EditChannelModalProps {
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

type TabValues = 'properties' | 'flex' | 'epg' | 'ffmpeg';

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

export default function EditChannelSettingsModal(props: EditChannelModalProps) {
  const {
    isPending: channelLoading,
    data: { channel: existingChannel, lineup: existingChannelLineup },
  } = useChannelAndLineup(props.channelNumber, !props.isNew);

  const queryClient = useQueryClient();

  const createChannel = useMutation({
    mutationFn: async (channel: UpdateChannelRequest) =>
      await apiClient.post('/api/v2/channels', channel),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        exact: false,
        queryKey: ['channels'],
      });
      props.onClose();
    },
  });

  const [currentTab, setCurrentTab] = useState<TabValues>(
    props.defaultTab ?? 'properties',
  );

  const onSave = (channel: Channel) => {
    createChannel.mutate({
      ...channel,
    });
  };

  const isEditingExistingChannel = !props.isNew;
  const isLoading = isEditingExistingChannel && channelLoading;
  const channel = isEditingExistingChannel
    ? existingChannel!
    : defaultNewChannel(props.channelNumber);

  useEffect(() => {
    if (props.open) {
      setCurrentChannel(channel, existingChannelLineup?.programs ?? []);
    }
  }, [channel, existingChannelLineup, props.open]);

  const handleChange = (_: React.SyntheticEvent, newValue: TabValues) =>
    setCurrentTab(newValue);

  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      maxWidth="md"
      fullWidth
      keepMounted={false}
    >
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
              {/* <Tab value="programming" label="Programming" /> */}
              <Tab value="flex" label="Flex" />
              <Tab value="epg" label="EPG" />
              <Tab value="ffmpeg" label="FFMPEG" />
            </Tabs>
          </Box>
          <TabPanel value="properties" currentValue={currentTab}>
            <ChannelPropertiesEditor />
          </TabPanel>
          {/* <TabPanel value="programming" currentValue={currentTab}>
            <ChannelProgrammingConfig />
          </TabPanel> */}
          <TabPanel value="flex" currentValue={currentTab}>
            <ChannelFlexConfig />
          </TabPanel>
          <TabPanel value="epg" currentValue={currentTab}>
            <ChannelEpgConfig />
          </TabPanel>
          <TabPanel value="ffmpeg" currentValue={currentTab}>
            <ChannelTranscodingConfig />
          </TabPanel>
        </DialogContent>
      )}

      <DialogActions>
        <Button onClick={props.onClose}>Cancel</Button>
        <Button onClick={() => onSave(channel)}>
          {isEditingExistingChannel ? 'Save' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
