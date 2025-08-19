import UnsavedNavigationAlert from '@/components/settings/UnsavedNavigationAlert.tsx';
import { DefaultChannel } from '@/helpers/constants.ts';
import { Badge } from '@mui/material';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { useNavigate } from '@tanstack/react-router';
import type {
  Channel,
  SaveableChannel,
  SubtitlePreference,
} from '@tunarr/types';
import { isEmpty, keys, map, reject, some } from 'lodash-es';
import { useCallback, useState } from 'react';
import {
  FormProvider,
  useForm,
  type SubmitErrorHandler,
  type SubmitHandler,
} from 'react-hook-form';
import type { DeepRequired, NonEmptyArray } from 'ts-essentials';
import { isNonEmptyString } from '../../helpers/util.ts';
import { useCreateChannel } from '../../hooks/useCreateChannel.ts';
import { useUpdateChannel } from '../../hooks/useUpdateChannel.ts';
import ChannelEditActions from './ChannelEditActions.tsx';
import ChannelEpgConfig from './ChannelEpgConfig.tsx';
import { ChannelFlexConfig } from './ChannelFlexConfig.tsx';
import { ChannelPropertiesEditor } from './ChannelPropertiesEditor.tsx';
import ChannelTranscodingConfig from './ChannelTranscodingConfig.tsx';
import {
  EditChannelTabPanel,
  type EditChannelTabProps,
  type EditChannelTabs,
} from './EditChannelTabPanel.tsx';

function getDefaultFormValues(channel: Channel): DeepRequired<SaveableChannel> {
  return {
    ...channel,
    streamMode: channel.streamMode ?? 'hls',
    fillerCollections: channel.fillerCollections ?? [],
    fillerRepeatCooldown:
      (channel.fillerRepeatCooldown
        ? channel.fillerRepeatCooldown
        : DefaultChannel.fillerRepeatCooldown!) / 1000,
    guideFlexTitle: channel.guideFlexTitle ?? '',
    guideMinimumDuration: channel.guideMinimumDuration / 1000,
    offline: {
      ...channel.offline,
      picture: channel.offline.picture ?? DefaultChannel.offline.picture ?? '',
      soundtrack:
        channel.offline.soundtrack ?? DefaultChannel.offline.soundtrack ?? '',
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
      opacity: channel.watermark?.opacity ?? 100,
      fadeConfig: channel.watermark?.fadeConfig?.map((conf) => ({
        ...conf,
        leadingEdge: conf.leadingEdge ?? false,
        programType: conf.programType ?? 'episode',
      })) ?? [
        {
          periodMins: 0,
          leadingEdge: true,
          programType: 'episode', // Unused
        },
      ],
    },
    onDemand: {
      enabled: channel.onDemand.enabled,
    },
    subtitlesEnabled: channel.subtitlesEnabled,
    subtitlePreferences: channel.subtitlePreferences ?? [],
  };
}

const EditChannelTabsProps: EditChannelTabProps[] = [
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
    description: 'Streaming',
    fields: [
      'watermark',
      'streamMode',
      'subtitlesEnabled',
      'subtitlePreferences',
    ],
  },
];

export function EditChannelForm({
  channel,
  isNew,
  initialTab,
}: EditChannelFormProps) {
  const navigate = useNavigate({
    from: isNew ? '/channels/new' : '/channels/$channelId/edit',
  });
  const [currentTab, setCurrentTab] = useState<EditChannelTabs>(
    initialTab ?? 'properties',
  );

  const formMethods = useForm<SaveableChannel>({
    mode: 'onChange',
    // Change this so we only load the form on initial...
    defaultValues: getDefaultFormValues(channel),
  });

  const createUpdateSuccessCallback = useCallback(
    (data: Channel) => {
      formMethods.reset(getDefaultFormValues(data), {
        keepDefaultValues: false,
        keepDirty: false,
      });
      if (isNew) {
        navigate({
          to: `/channels/$channelId/programming`,
          params: { channelId: data.id },
        }).catch(console.warn);
      }
    },
    [formMethods, isNew, navigate],
  );

  const updateChannelMutation = useUpdateChannel({
    onSuccess: createUpdateSuccessCallback,
  });

  const createChannelMutation = useCreateChannel({
    onSuccess: createUpdateSuccessCallback,
  });

  const formIsValid = formMethods.formState.isValid;
  const formErrorKeys = keys(
    formMethods.formState.errors,
  ) as (keyof SaveableChannel)[];
  const formIsDirty = formMethods.formState.isDirty;

  const onSubmit: SubmitHandler<SaveableChannel> = (data) => {
    const fadeConfigs = reject(
      data.watermark?.fadeConfig,
      (conf) => conf.periodMins <= 0,
    );

    const preferences =
      !data.subtitlePreferences || data.subtitlePreferences.length === 0
        ? undefined
        : map(data.subtitlePreferences, (pref, idx) => ({
            ...pref,
            priority: idx,
          }));

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
      fillerCollections: data.fillerCollections,
      watermark: data.watermark
        ? {
            ...data.watermark,
            fadeConfig: isEmpty(fadeConfigs) ? undefined : fadeConfigs,
          }
        : undefined,
      subtitlePreferences: preferences as NonEmptyArray<SubtitlePreference>,
    } satisfies SaveableChannel;

    if (isNew) {
      createChannelMutation.mutate({
        body: {
          type: 'new',
          channel: dataTransform,
        },
      });
    } else {
      updateChannelMutation.mutate({
        path: { id: channel.id },
        body: dataTransform,
      });
    }
  };

  const onInvalid: SubmitErrorHandler<SaveableChannel> = (data) => {
    console.error(data, formMethods.getValues());
  };

  const handleChange = (_: React.SyntheticEvent, newValue: EditChannelTabs) => {
    if (newValue !== currentTab) {
      setCurrentTab(newValue);
      // Don't enable routing for new channel, yet.
      if (!isNew) {
        navigate({
          replace: true,
          search: { tab: newValue === 'properties' ? undefined : newValue },
        }).catch(console.warn);
      }
    }
  };

  const renderTab = (tab: EditChannelTabProps) => {
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

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ borderColor: 'primary', borderBottom: 1 }}>
        <Tabs
          value={currentTab}
          onChange={handleChange}
          variant="scrollable"
          allowScrollButtonsMobile
        >
          {EditChannelTabsProps.map(renderTab)}
        </Tabs>
      </Box>
      <FormProvider {...formMethods}>
        <Box
          component="form"
          onSubmit={formMethods.handleSubmit(onSubmit, onInvalid)}
        >
          <EditChannelTabPanel value="properties" currentValue={currentTab}>
            <ChannelPropertiesEditor />
          </EditChannelTabPanel>
          <EditChannelTabPanel value="flex" currentValue={currentTab}>
            <ChannelFlexConfig />
          </EditChannelTabPanel>
          <EditChannelTabPanel value="epg" currentValue={currentTab}>
            <ChannelEpgConfig />
          </EditChannelTabPanel>
          <EditChannelTabPanel value="ffmpeg" currentValue={currentTab}>
            <ChannelTranscodingConfig />
          </EditChannelTabPanel>
          <ChannelEditActions isNewChannel={isNew} />
        </Box>
      </FormProvider>
      {!isNew && <UnsavedNavigationAlert isDirty={formIsDirty} />}
    </Paper>
  );
}
export type EditChannelFormProps = {
  channel: Channel;
  isNew: boolean;
  initialTab?: EditChannelTabs;
};
