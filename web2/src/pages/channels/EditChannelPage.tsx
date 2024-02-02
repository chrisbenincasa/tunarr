import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Paper from '@mui/material/Paper';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { useCallback, useState } from 'react';
import { useEffectOnce } from 'usehooks-ts';
import ChannelEpgConfig from '../../components/channel_config/ChannelEpgConfig.tsx';
import { ChannelFlexConfig } from '../../components/channel_config/ChannelFlexConfig.tsx';
import ChannelPropertiesEditor from '../../components/channel_config/ChannelPropertiesEditor.tsx';
import ChannelTranscodingConfig from '../../components/channel_config/ChannelTranscodingConfig.tsx';
import { usePreloadedData } from '../../hooks/preloadedDataHook.ts';
import { setCurrentChannel } from '../../store/channelEditor/actions.ts';
import useStore from '../../store/index.ts';
import {
  ChannelEditContext,
  ChannelEditContextState,
} from './EditChannelContext.ts';
import { editChannelLoader } from './loaders.ts';
import { FormProvider, SubmitHandler, useForm } from 'react-hook-form';
import { Channel, SaveChannelRequest } from '@tunarr/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../external/api.ts';

type TabValues = 'properties' | 'flex' | 'epg' | 'ffmpeg';

type TabProps = { value: TabValues; description: string };

const tabs: TabProps[] = [
  {
    value: 'properties',
    description: 'Properties',
  },
  {
    value: 'flex',
    description: 'Flex',
  },
  {
    value: 'epg',
    description: 'EPG',
  },
  {
    value: 'ffmpeg',
    description: 'FFMPEG',
  },
];

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

type Props = {
  isNew: boolean;
};

export default function EditChannelPage({ isNew }: Props) {
  const channel = usePreloadedData(editChannelLoader(isNew));
  const [currentTab, setCurrentTab] = useState<TabValues>('properties');
  const { currentEntity: workingChannel, originalEntity: originalChannel } =
    useStore((s) => s.channelEditor);

  const [channelEditorState, setChannelEditorState] =
    useState<ChannelEditContextState>({
      currentTabValid: true,
      isNewChannel: isNew,
    });

  const handleChange = (_: React.SyntheticEvent, newValue: TabValues) =>
    setCurrentTab(newValue);

  useEffectOnce(() => {
    setCurrentChannel(channel, []);
  });

  const queryClient = useQueryClient();

  const formMethods = useForm<SaveChannelRequest>({
    mode: 'onChange',
    // Change this so we only load the form on initial...
    defaultValues: originalChannel ?? channel,
  });

  // make sure formState is read before render to enable the Proxy
  const formIsValid = formMethods.formState.isValid;

  const navigate = useNavigate();
  const updateChannel = useMutation({
    mutationFn: async (channelUpdates: SaveChannelRequest) => {
      if (isNew) {
        return apiClient.createChannel(channelUpdates);
      } else {
        return apiClient.updateChannel(channelUpdates, {
          params: { id: channel.id },
        });
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        exact: false,
        queryKey: ['channels'],
      });
      if (isNew) {
        navigate('/channels');
      } else {
        updateChannel.reset();
      }
    },
  });

  const resetChannel = useCallback(() => {
    formMethods.reset();
  }, [formMethods]);

  const renderTab = (tab: TabProps) => {
    return (
      <Tab
        key={tab.value}
        disabled={isNew && tab.value !== currentTab && !formIsValid}
        value={tab.value}
        label={tab.description}
      />
    );
  };

  const onSubmit: SubmitHandler<SaveChannelRequest> = (data) => {
    updateChannel.mutate(data);
    console.log(data);
  };

  return (
    <ChannelEditContext.Provider
      value={{ channelEditorState, setChannelEditorState }}
    >
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          underline="hover"
          color="inherit"
          component={RouterLink}
          to="/channels"
        >
          Back
        </Link>
      </Breadcrumbs>
      {workingChannel && (
        <div>
          <Typography variant="h4" sx={{ mb: 2 }}>
            Channel {workingChannel.number}
          </Typography>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ borderColor: 'primary', borderBottom: 1 }}>
              <Tabs value={currentTab} onChange={handleChange}>
                {tabs.map(renderTab)}
              </Tabs>
            </Box>
            <FormProvider {...formMethods}>
              <Box
                component="form"
                onSubmit={formMethods.handleSubmit(onSubmit)}
              >
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
              </Box>
            </FormProvider>
          </Paper>
        </div>
      )}
    </ChannelEditContext.Provider>
  );
}
