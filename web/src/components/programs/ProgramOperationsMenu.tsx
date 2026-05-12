import { Trans } from '@lingui/react/macro';
import { Info, Refresh, Troubleshoot } from '@mui/icons-material';
import type { PopoverProps } from '@mui/material';
import { ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import { prettifySnakeCaseString } from '@tunarr/shared/util';
import type { ProgramLike, TupleToUnion } from '@tunarr/types';
import { isTerminalItemType } from '@tunarr/types';
import { useToggle } from '@uidotdev/usehooks';
import { merge } from 'lodash-es';
import { useCallback, useMemo } from 'react';
import type { DeepRequired } from 'ts-essentials';
import { useScanNow } from '../../hooks/useScanNow.ts';
import { MenuItemLink } from '../base/RouterButtonLink.tsx';
import ProgramDetailsDialog from './ProgramDetailsDialog.tsx';

const Options = ['scan', 'details', 'troubleshoot'] as const;
type Options = TupleToUnion<typeof Options>;
type OptionVisibility = {
  [K in Options]?: boolean;
};

const DefaultOptionVisibility: DeepRequired<OptionVisibility> = {
  scan: true,
  details: true,
  troubleshoot: false,
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
  }, [onClose, programId, triggerScan]);

  const availableOptions = useMemo(
    (): DeepRequired<OptionVisibility> =>
      merge(
        DefaultOptionVisibility,
        {
          troubleshoot: isTerminalItemType(programType),
        } satisfies Partial<OptionVisibility>,
        options,
      ),
    [options, programType],
  );

  const openDialog = useCallback(() => {
    setDialogOpen(true);
    onClose();
  }, [onClose, setDialogOpen]);

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
            <ListItemText>
              <Trans>View Full Details</Trans>
            </ListItemText>
          </MenuItem>
        )}
        {availableOptions.scan && (
          <MenuItem onClick={() => scanItem()}>
            <ListItemIcon>
              <Refresh fontSize="small" />
            </ListItemIcon>
            <ListItemText>
              <Trans>Scan {prettifySnakeCaseString(programType)}</Trans>
            </ListItemText>
          </MenuItem>
        )}
        {availableOptions.troubleshoot && (
          <MenuItemLink to={'/system/troubleshoot'} search={{ programId }}>
            <ListItemIcon>
              <Troubleshoot fontSize="small" />
            </ListItemIcon>
            <ListItemText>Troubleshoot</ListItemText>
          </MenuItemLink>
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
