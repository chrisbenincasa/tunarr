import Box from '@mui/material/Box';
import { SaveChannelRequest } from '@tunarr/types';
import { FieldPath } from 'react-hook-form';

export function EditChannelTabPanel(props: EditChannelTabPanelProps) {
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
export interface EditChannelTabPanelProps {
  children?: React.ReactNode;
  currentValue: EditChannelTabs;
  value: EditChannelTabs;
}
export type EditChannelTabs = 'properties' | 'flex' | 'epg' | 'ffmpeg';

export type EditChannelTabProps = {
  value: EditChannelTabs;
  description: string;
  fields: FieldPath<SaveChannelRequest>[];
};

export const EditChannelTabsProps: EditChannelTabProps[] = [
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
