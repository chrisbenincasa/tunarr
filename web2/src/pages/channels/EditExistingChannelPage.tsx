import { Paper, Typography } from '@mui/material';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { Channel } from 'dizquetv-types';
import { useState } from 'react';
import ChannelEpgConfig from '../../components/channel_config/ChannelEpgConfig.tsx';
import { ChannelFlexConfig } from '../../components/channel_config/ChannelFlexConfig.tsx';
import ChannelPropertiesEditor from '../../components/channel_config/ChannelPropertiesEditor.tsx';
import ChannelTranscodingConfig from '../../components/channel_config/ChannelTranscodingConfig.tsx';
import { usePreloadedData } from '../../hooks/preloadedDataHook.ts';
import { setCurrentChannel } from '../../store/channelEditor/actions.ts';
import { editChannelLoader } from './loaders.ts';
import dayjs from 'dayjs';
import EditChannelControls from '../../components/channel_config/EditChannelControls.tsx';

type TabValues = 'properties' | 'flex' | 'epg' | 'ffmpeg';

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

export default function EditExistingChannelPage() {
  const channel = usePreloadedData(editChannelLoader);

  setCurrentChannel(channel, []);

  return (
    <div>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Channel {channel.number}
      </Typography>
      <EditChannelControls />
    </div>
  );
}
