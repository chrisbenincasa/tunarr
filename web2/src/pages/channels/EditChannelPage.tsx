import { Badge } from '@mui/material';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SaveChannelRequest } from '@tunarr/types';
import { usePrevious } from '@uidotdev/usehooks';
import { ZodiosError } from '@zodios/core';
import { keys, some } from 'lodash-es';
import { useEffect, useState } from 'react';
import {
  FieldPath,
  FormProvider,
  SubmitErrorHandler,
  SubmitHandler,
  useForm,
} from 'react-hook-form';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useEffectOnce } from 'usehooks-ts';
import ChannelEpgConfig from '../../components/channel_config/ChannelEpgConfig.tsx';
import { ChannelFlexConfig } from '../../components/channel_config/ChannelFlexConfig.tsx';
import ChannelPropertiesEditor from '../../components/channel_config/ChannelPropertiesEditor.tsx';
import ChannelTranscodingConfig from '../../components/channel_config/ChannelTranscodingConfig.tsx';
import { apiClient } from '../../external/api.ts';
import { usePreloadedData } from '../../hooks/preloadedDataHook.ts';
import { setCurrentChannel } from '../../store/channelEditor/actions.ts';
import useStore from '../../store/index.ts';
import {
  ChannelEditContext,
  ChannelEditContextState,
} from './EditChannelContext.ts';
import { editChannelLoader } from './loaders.ts';

type TabValues = 'properties' | 'flex' | 'epg' | 'ffmpeg';

type TabProps = {
  value: TabValues;
  description: string;
  fields: FieldPath<SaveChannelRequest>[];
};

const tabs: TabProps[] = [
  {
    value: 'properties',
    description: 'Properties',
    fields: ['number', 'name', 'groupTitle'],
  },
  {
    value: 'flex',
    description: 'Flex',
    fields: ['offline'],
  },
  {
    value: 'epg',
    description: 'EPG',
    fields: ['stealth', 'guideFlexPlaceholder', 'guideMinimumDuration'],
  },
  {
    value: 'ffmpeg',
    description: 'FFMPEG',
    fields: ['transcoding'],
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
  const { currentEntity: workingChannel } = useStore((s) => s.channelEditor);
  const previousChannel = usePrevious(workingChannel);

  const [channelEditorState, setChannelEditorState] =
    useState<ChannelEditContextState>({
      currentTabValid: true,
      isNewChannel: isNew,
    });

  const handleChange = (_: React.SyntheticEvent, newValue: TabValues) =>
    setCurrentTab(newValue);

  const queryClient = useQueryClient();

  const formMethods = useForm<SaveChannelRequest>({
    mode: 'onChange',
    // Change this so we only load the form on initial...
    // eslint-disable-next-line @typescript-eslint/require-await
    defaultValues: async () => {
      const c = previousChannel ?? channel;
      return {
        ...c,
        guideMinimumDuration: c.guideMinimumDuration / 1000,
      };
    },
  });

  useEffectOnce(() => {
    setCurrentChannel(channel);
  });

  useEffect(() => {
    if (
      workingChannel &&
      previousChannel &&
      workingChannel.id !== previousChannel.id
    ) {
      formMethods.reset({
        ...workingChannel,
        guideMinimumDuration: workingChannel.guideMinimumDuration / 1000,
      });
    }
  }, [workingChannel, previousChannel, formMethods]);

  // make sure formState is read before render to enable the Proxy
  const formIsValid = formMethods.formState.isValid;
  const formErrorKeys = keys(
    formMethods.formState.errors,
  ) as (keyof SaveChannelRequest)[];

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
    onError: (error) => {
      if (error instanceof ZodiosError) {
        console.error(error.data);
        console.error(error, error.cause);
      }
    },
  });

  const renderTab = (tab: TabProps) => {
    const hasError = some(formErrorKeys, (k) => tab.fields.includes(k));
    return (
      <Tab
        key={tab.value}
        disabled={isNew && tab.value !== currentTab && !formIsValid}
        value={tab.value}
        label={
          <Badge
            color="error"
            variant="dot"
            slotProps={{ badge: { style: { right: -3, top: -3 } } }}
            invisible={!hasError}
          >
            {tab.description}
          </Badge>
        }
      />
    );
  };

  const onSubmit: SubmitHandler<SaveChannelRequest> = (data) => {
    console.log(data);
    updateChannel.mutate({
      ...data,
      // Transform this to milliseconds before we send it over
      guideMinimumDuration: data.guideMinimumDuration * 1000,
    });
  };

  const onInvalid: SubmitErrorHandler<SaveChannelRequest> = (data) => {
    console.error(data, formMethods.getValues());
  };

  return (
    <ChannelEditContext.Provider
      value={{ channelEditorState, setChannelEditorState }}
    >
      <Breadcrumbs sx={{ mb: 2 }} separator="›" aria-label="channel-breadcrumb">
        <Link
          underline="hover"
          color="inherit"
          component={RouterLink}
          to="/channels"
        >
          Channels
        </Link>
        <Box>Edit Channel</Box>
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
                onSubmit={formMethods.handleSubmit(onSubmit, onInvalid)}
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
