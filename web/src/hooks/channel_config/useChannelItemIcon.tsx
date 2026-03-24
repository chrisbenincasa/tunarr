import { ListItemIcon } from '@mui/material';
import { useMemo } from 'react';
import { ChannelItemIcon } from '../../components/base/ChannelItemIcon.tsx';
import type { UIChannelProgram } from '../../types/index.ts';

export const useChannelListItemIcon = (program: UIChannelProgram) => {
  return useMemo(() => {
    let icon = <ChannelItemIcon program={program} />;
    if (icon !== null) {
      icon = (
        <ListItemIcon sx={{ color: 'currentcolor', minWidth: 0, pr: 1 }}>
          {icon}
        </ListItemIcon>
      );
    }
    return icon;
  }, [program]);
};
