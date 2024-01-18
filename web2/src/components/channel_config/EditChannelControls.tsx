import { Paper } from '@mui/material';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { useState } from 'react';
import ChannelEpgConfig from './ChannelEpgConfig.tsx';
import { ChannelFlexConfig } from './ChannelFlexConfig.tsx';
import ChannelPropertiesEditor from './ChannelPropertiesEditor.tsx';
import ChannelTranscodingConfig from './ChannelTranscodingConfig.tsx';

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

export default function EditChannelControls() {
  const [currentTab, setCurrentTab] = useState<TabValues>('properties');

  const handleChange = (_: React.SyntheticEvent, newValue: TabValues) =>
    setCurrentTab(newValue);

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ borderColor: 'primary', borderBottom: 1 }}>
        <Tabs value={currentTab} onChange={handleChange}>
          <Tab value="properties" label="Properties" />
          <Tab value="flex" label="Flex" />
          <Tab value="epg" label="EPG" />
          <Tab value="ffmpeg" label="FFMPEG" />
        </Tabs>
      </Box>
      <TabPanel value="properties" currentValue={currentTab}>
        <ChannelPropertiesEditor />
      </TabPanel>
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
  );
}
