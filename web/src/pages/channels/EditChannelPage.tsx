import { Badge } from '@mui/material';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { SaveChannelRequest } from '@tunarr/types';
import { usePrevious } from '@uidotdev/usehooks';
import { keys, some } from 'lodash-es';
import { useEffect, useState } from 'react';
import {
  FieldPath,
  FormProvider,
  SubmitErrorHandler,
  SubmitHandler,
  useForm,
} from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import Breadcrumbs from '../../components/Breadcrumbs.tsx';
import ChannelEpgConfig from '../../components/channel_config/ChannelEpgConfig.tsx';
import { ChannelFlexConfig } from '../../components/channel_config/ChannelFlexConfig.tsx';
import ChannelPropertiesEditor from '../../components/channel_config/ChannelPropertiesEditor.tsx';
import ChannelTranscodingConfig from '../../components/channel_config/ChannelTranscodingConfig.tsx';
import UnsavedNavigationAlert from '../../components/settings/UnsavedNavigationAlert.tsx';
import { isNonEmptyString } from '../../helpers/util.ts';
import { usePreloadedData } from '../../hooks/preloadedDataHook.ts';
import { useUpdateChannel } from '../../hooks/useUpdateChannel.ts';
import {
  DefaultChannel,
  defaultNewChannel,
  editChannelLoader,
} from '../../preloaders/channelLoaders.ts';
import { setCurrentChannel } from '../../store/channelEditor/actions.ts';
import useStore from '../../store/index.ts';
import {
  ChannelEditContext,
  ChannelEditContextState,
} from './EditChannelContext.ts';

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
    fields: ['number', 'name', 'groupTitle', 'icon'],
  },
  {
    value: 'flex',
    description: 'Flex',
    fields: ['offline', 'fillerCollections', 'fillerRepeatCooldown'],
  },
  {
    value: 'epg',
    description: 'EPG',
    fields: ['stealth', 'guideFlexTitle', 'guideMinimumDuration'],
  },
  {
    value: 'ffmpeg',
    description: 'FFMPEG',
    fields: ['transcoding', 'watermark'],
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
  initialTab?: TabValues;
};

export default function EditChannelPage({ isNew, initialTab }: Props) {
  const channel = usePreloadedData(editChannelLoader(isNew));
  const [currentTab, setCurrentTab] = useState<TabValues>(
    initialTab ?? 'properties',
  );
  const { currentEntity: workingChannel } = useStore((s) => s.channelEditor);
  const previousChannel = usePrevious(workingChannel);
  const navigate = useNavigate();

  const [channelEditorState, setChannelEditorState] =
    useState<ChannelEditContextState>({
      currentTabValid: true,
      isNewChannel: isNew,
    });

  const handleChange = (_: React.SyntheticEvent, newValue: TabValues) => {
    if (newValue !== currentTab) {
      setCurrentTab(newValue);
      // Don't enable routing for new channel, yet.
      if (!isNew) {
        let path: string = currentTab === 'properties' ? '.' : '..';
        if (newValue !== 'properties') {
          path = `${path}/${newValue}`;
        }

        navigate(path, { relative: 'path', replace: true });
      }
    }
  };

  const formMethods = useForm<SaveChannelRequest>({
    mode: 'onChange',
    // Change this so we only load the form on initial...
    // eslint-disable-next-line @typescript-eslint/require-await
    defaultValues: {
      ...defaultNewChannel(-1),
      transcoding: {
        targetResolution: 'global',
        videoBitrate: 'global',
        videoBufferSize: 'global',
      },
    },
  });

  useEffect(() => {
    setCurrentChannel(channel);
    formMethods.reset({
      ...channel,
      fillerCollections: channel.fillerCollections ?? [],
      fillerRepeatCooldown: channel.fillerRepeatCooldown
        ? channel.fillerRepeatCooldown / 1000
        : DefaultChannel.fillerRepeatCooldown,
      guideFlexTitle: channel.guideFlexTitle ?? '',
      guideMinimumDuration: channel.guideMinimumDuration / 1000,
      transcoding: {
        targetResolution: channel.transcoding?.targetResolution ?? 'global',
        videoBitrate: channel.transcoding?.videoBitrate ?? 'global',
        videoBufferSize: channel.transcoding?.videoBufferSize ?? 'global',
      },
      offline: {
        ...channel.offline,
        picture: channel.offline.picture ?? DefaultChannel.offline.picture,
      },
      watermark: {
        ...(channel.watermark ?? {}),
        enabled: channel.watermark?.enabled ?? false,
        url: channel.watermark?.url ?? '',
        width: channel.watermark?.width ?? 10,
        horizontalMargin: channel.watermark?.horizontalMargin ?? 1,
        verticalMargin: channel.watermark?.verticalMargin ?? 1,
        fixedSize: channel.watermark?.fixedSize ?? false,
        animated: channel.watermark?.animated ?? false,
        duration: channel.watermark?.duration ?? 0,
        position: channel.watermark?.position ?? 'bottom-right',
      },
    });
  }, [channel, formMethods]);

  useEffect(() => {
    if (
      workingChannel &&
      previousChannel &&
      workingChannel.id !== previousChannel.id
    ) {
      formMethods.reset({
        ...workingChannel,
        fillerRepeatCooldown: workingChannel.fillerRepeatCooldown
          ? workingChannel.fillerRepeatCooldown / 1000
          : DefaultChannel.fillerRepeatCooldown,
        guideMinimumDuration: workingChannel.guideMinimumDuration / 1000,
        guideFlexTitle: workingChannel.guideFlexTitle ?? '',
      });
    }
  }, [workingChannel, previousChannel, formMethods]);

  // make sure formState is read before render to enable the Proxy
  const formIsValid = formMethods.formState.isValid;
  const formErrorKeys = keys(
    formMethods.formState.errors,
  ) as (keyof SaveChannelRequest)[];
  const formIsDirty = formMethods.formState.isDirty;

  const updateChannelMutation = useUpdateChannel(isNew);

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
    const dataTransform = {
      ...data,
      // Transform this to milliseconds before we send it over
      guideMinimumDuration: data.guideMinimumDuration * 1000,
      fillerRepeatCooldown: data.fillerRepeatCooldown
        ? data.fillerRepeatCooldown * 1000
        : undefined,
      guideFlexTitle: isNonEmptyString(data.guideFlexTitle)
        ? data.guideFlexTitle
        : undefined,
    };

    formMethods.reset(dataTransform);
    updateChannelMutation.mutate(dataTransform);
  };

  const onInvalid: SubmitErrorHandler<SaveChannelRequest> = (data) => {
    console.error(data, formMethods.getValues());
  };

  return (
    <ChannelEditContext.Provider
      value={{ channelEditorState, setChannelEditorState }}
    >
      <Breadcrumbs />
      {workingChannel && (
        <div>
          <Typography variant="h4" sx={{ mb: 2 }}>
            {channel.name}
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
                  <ChannelPropertiesEditor isNew={isNew} />
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
            <UnsavedNavigationAlert
              isDirty={formIsDirty}
              exemptPath="channels/:id/edit/*"
            />
          </Paper>
        </div>
      )}
    </ChannelEditContext.Provider>
  );
}
