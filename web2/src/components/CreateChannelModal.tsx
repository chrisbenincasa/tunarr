import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { ChannelProgrammingConfig } from './channel_config/ChannelProgrammingConfig.tsx';

interface CreateChannelModalProps {
  open: boolean;
  onClose: () => void;
  defaultTab?: TabValues;
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
      {value === currentValue && (
        <Box sx={{ p: 3 }}>
          <Typography>{children}</Typography>
        </Box>
      )}
    </div>
  );
}

type TabValues = 'properties' | 'programming' | 'flex' | 'epg' | 'ffmpeg';

export default function CreateChannelModal(props: CreateChannelModalProps) {
  const [currentTab, setCurrentTab] = useState<TabValues>(
    props.defaultTab ?? 'properties',
  );

  const handleChange = (_: React.SyntheticEvent, newValue: TabValues) =>
    setCurrentTab(newValue);

  return (
    <Dialog open={props.open} onClose={props.onClose}>
      <DialogTitle>Create A Channel</DialogTitle>
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
          Properties
        </TabPanel>
        <TabPanel value="programming" currentValue={currentTab}>
          <ChannelProgrammingConfig />
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
      <DialogActions>
        <Button onClick={props.onClose}>Cancel</Button>
        <Button>Create</Button>
      </DialogActions>
    </Dialog>
  );
}
