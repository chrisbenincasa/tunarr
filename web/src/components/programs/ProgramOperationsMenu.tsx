import { Info, Refresh } from '@mui/icons-material';
import type { PopoverProps } from '@mui/material';
import { ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import { prettifySnakeCaseString } from '@tunarr/shared/util';
import { isTerminalItemType, ProgramLike, TupleToUnion } from '@tunarr/types';
import { useToggle } from '@uidotdev/usehooks';
import { merge } from 'lodash-es';
import { useCallback, useMemo } from 'react';
import { DeepRequired } from 'ts-essentials';
import { useScanNow } from '../../hooks/useScanNow.ts';
import ProgramDetailsDialog from './ProgramDetailsDialog.tsx';

const Options = ['scan', 'details'] as const;
type Options = TupleToUnion<typeof Options>;
type OptionVisibility = {
  [K in Options]?: boolean;
};

const DefaultOptionVisibility: DeepRequired<OptionVisibility> = {
  scan: true,
  details: true,
};

type Props = {
  programId: string;
  programType: ProgramLike['type'];
  anchorEl: PopoverProps['anchorEl'];
  open: boolean;
  onClose: () => void;
  options?: OptionVisibility;
};

export const ProgramOperationsMenu = ({
  programId,
  programType,
  anchorEl,
  open,
  onClose,
  options = DefaultOptionVisibility,
}: Props) => {
  const [dialogOpen, setDialogOpen] = useToggle(false);
  const triggerScan = useScanNow();

  const scanItem = useCallback(() => {
    triggerScan(programId);

    onClose();
  }, [programId, triggerScan]);

  const availableOptions = useMemo(
    () => merge(DefaultOptionVisibility, options),
    [options],
  );

  const openDialog = useCallback(() => {
    setDialogOpen(true);
    onClose();
  }, []);

  return (
    <>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => onClose()}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {availableOptions.scan && (
          <MenuItem onClick={() => openDialog()}>
            <ListItemIcon>
              <Info fontSize="small" />
            </ListItemIcon>
            <ListItemText>View Full Details</ListItemText>
          </MenuItem>
        )}
        {availableOptions.scan && (
          <MenuItem onClick={() => scanItem()}>
            <ListItemIcon>
              <Refresh fontSize="small" />
            </ListItemIcon>
            <ListItemText>
              Scan {prettifySnakeCaseString(programType)}
            </ListItemText>
          </MenuItem>
        )}
      </Menu>
      <ProgramDetailsDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        programId={programId}
        programType={programType}
        panelVisibility={{
          metadata: false,
          stream_details: isTerminalItemType(programType),
        }}
      />
    </>
  );
};
