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

// TODO remove lint warning when we use this
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function defaultNewChannel(num: number): Channel {
  return {
    name: `Channel ${num}`,
    number: num,
    startTime: dayjs().unix() * 1000,
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

export default function EditChannelPage() {
  const [currentTab, setCurrentTab] = useState<TabValues>('properties');

  const channel = usePreloadedData(editChannelLoader);

  setCurrentChannel(channel, []);

  const handleChange = (_: React.SyntheticEvent, newValue: TabValues) =>
    setCurrentTab(newValue);

  return (
    <div>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Channel {channel.number}
      </Typography>
      <Paper sx={{ p: 2 }}>
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
      </Paper>
    </div>
  );
}
