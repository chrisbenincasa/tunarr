import { Refresh } from '@mui/icons-material';
import type { PopoverProps } from '@mui/material';
import { ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import { useCallback } from 'react';
import { useScanNow } from '../../hooks/useScanNow.ts';

type Props = {
  programId: string;
  anchorEl: PopoverProps['anchorEl'];
  open: boolean;
  onClose: () => void;
};

export const ProgramOperationsMenu = ({
  programId,
  anchorEl,
  open,
  onClose,
}: Props) => {
  const triggerScan = useScanNow();

  const scanItem = useCallback(() => {
    triggerScan(programId);

    onClose();
  }, [programId, triggerScan]);

  return (
    <Menu anchorEl={anchorEl} open={open} onClose={() => onClose()}>
      <MenuItem onClick={() => scanItem()}>
        <ListItemIcon>
          <Refresh fontSize="small" />
        </ListItemIcon>
        <ListItemText>Scan</ListItemText>
      </MenuItem>
    </Menu>
  );
};
