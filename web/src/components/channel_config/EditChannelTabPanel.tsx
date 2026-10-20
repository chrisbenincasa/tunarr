import Box from '@mui/material/Box';
import type { SaveableChannel } from '@tunarr/types';
import { memo, useState } from 'react';
import type { FieldPath } from 'react-hook-form';

function isActive(props: EditChannelTabPanelProps) {
  return props.value === props.currentValue;
}

// A panel mounts on its first visit and stays mounted, so switching back to
// it only toggles visibility. Panels read form values with `watch`, which
// re-renders the whole form on every change. A hidden panel skips those
// renders and catches up when it becomes active again.

export const EditChannelTabPanel = memo(
  function EditChannelTabPanel(props: EditChannelTabPanelProps) {
    const { children, currentValue } = props;
    const active = isActive(props);
    const [visited, setVisited] = useState(active);

    if (active && !visited) {
      setVisited(true);
    }

    return (
      <div
        role="tabpanel"
        hidden={!active}
        id={`simple-tabpanel-${currentValue}`}
        aria-labelledby={`simple-tab-${currentValue}`}
      >
        {visited && <Box sx={{ p: 3 }}>{children}</Box>}
      </div>
    );
  },
  (prev, next) => !isActive(prev) && !isActive(next),
);

interface EditChannelTabPanelProps {
  children?: React.ReactNode;
  currentValue: EditChannelTabs;
  value: EditChannelTabs;
}
export type EditChannelTabs = 'properties' | 'flex' | 'epg' | 'ffmpeg';

export type EditChannelTabProps = {
  value: EditChannelTabs;
  description: string;
  fields: FieldPath<SaveableChannel>[];
};
