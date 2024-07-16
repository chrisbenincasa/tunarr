import UnsavedNavigationAlert from '@/components/settings/UnsavedNavigationAlert.tsx';
import { DefaultChannel } from '@/helpers/constants.ts';
import { Badge } from '@mui/material';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { useNavigate } from '@tanstack/react-router';
import { Channel, SaveChannelRequest } from '@tunarr/types';
import { keys, some } from 'lodash-es';
import { useState } from 'react';
import {
  FormProvider,
  SubmitErrorHandler,
  SubmitHandler,
  useForm,
} from 'react-hook-form';
import { isNonEmptyString } from '../../helpers/util.ts';
import { useUpdateChannel } from '../../hooks/useUpdateChannel.ts';
import ChannelEpgConfig from './ChannelEpgConfig.tsx';
import { ChannelFlexConfig } from './ChannelFlexConfig.tsx';
import { ChannelPropertiesEditor } from './ChannelPropertiesEditor.tsx';
import ChannelTranscodingConfig from './ChannelTranscodingConfig.tsx';
import {
  EditChannelTabPanel,
  EditChannelTabProps,
  EditChannelTabs,
  EditChannelTabsProps,
} from './EditChannelTabPanel.tsx';
import ChannelEditActions from './ChannelEditActions.tsx';

export function EditChannelForm({
  channel,
  isNew,
  initialTab,
}: EditChannelFormProps) {
  const navigate = useNavigate();
  const [currentTab, setCurrentTab] = useState<EditChannelTabs>(
    initialTab ?? 'properties',
  );

  const formMethods = useForm<SaveChannelRequest>({
    mode: 'onChange',
    // Change this so we only load the form on initial...
    // eslint-disable-next-line @typescript-eslint/require-await
    defaultValues: {
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
        soundtrack:
          channel.offline.soundtrack ?? DefaultChannel.offline.soundtrack,
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
      },
      onDemand: {
        enabled: channel.onDemand.enabled,
      },
    },
  });

  const updateChannelMutation = useUpdateChannel(isNew, {
    onSuccess: (data) => {
      console.log('resetting some bullshit');
      formMethods.reset(data, { keepDefaultValues: false });
      if (isNew) {
        navigate({
          to: `/channels/$channelId/programming`,
          params: { channelId: data.id },
        }).catch(console.warn);
      }
    },
  });

  const formIsValid = formMethods.formState.isValid;
  const formErrorKeys = keys(
    formMethods.formState.errors,
  ) as (keyof SaveChannelRequest)[];
  const formIsDirty = formMethods.formState.isDirty;

  const onSubmit: SubmitHandler<SaveChannelRequest> = (data) => {
    const dataTransform: SaveChannelRequest = {
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
    };

    updateChannelMutation.mutate(dataTransform);
  };

  const onInvalid: SubmitErrorHandler<SaveChannelRequest> = (data) => {
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
            <ChannelPropertiesEditor isNew={isNew} />
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
