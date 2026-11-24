import { useSettings } from '@/store/settings/selectors.ts';
import { BugReport, OpenInNew } from '@mui/icons-material';
import { IconButton, Link, ListItemIcon, Menu, MenuItem } from '@mui/material';
import type { ChannelProgram } from '@tunarr/types';
import { isUndefined } from 'lodash-es';
import { useState } from 'react';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard.ts';
import {
  extractProgramGrandparent,
  extractProgramParent,
} from '../helpers/programUtil.ts';

type Props = {
  program: ChannelProgram;
};

function debugTargets(program: ChannelProgram) {
  switch (program.type) {
    case 'content':
      return { programId: program.id, terminalProgram: program.program };
    case 'custom':
      return {
        programId: program.id,
        terminalProgram: program.program?.program,
      };
    case 'redirect':
    case 'flex':
    case 'filler':
      return { programId: undefined, terminalProgram: undefined };
  }
}

// eslint-disable-next-line react-refresh/only-export-components
const ProgramDebugDetailsMenuImpl = ({ program }: Props) => {
  const { backendUri } = useSettings();
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const copyToClipboard = useCopyToClipboard();

  const { programId, terminalProgram } = debugTargets(program);
  const parentId = terminalProgram
    ? extractProgramParent(terminalProgram)?.uuid
    : undefined;
  const grandparentId = terminalProgram
    ? extractProgramGrandparent(terminalProgram)?.uuid
    : undefined;

  const handleCopy = (id: string) => {
    copyToClipboard(id).catch(console.warn);
    setMenuAnchorEl(null);
  };

  return (
    <>
      <IconButton
        sx={{ mr: 1 }}
        size="large"
        onClick={(e) => setMenuAnchorEl(e.currentTarget)}
      >
        <BugReport />
      </IconButton>
      <Menu
        open={!!menuAnchorEl}
        anchorEl={menuAnchorEl}
        onClose={() => setMenuAnchorEl(null)}
      >
        <MenuItem
          disabled={isUndefined(programId)}
          target="_blank"
          href={`${backendUri}/api/programs/${programId}`}
          component={Link}
        >
          <ListItemIcon>
            <OpenInNew />
          </ListItemIcon>
          Program Details
        </MenuItem>
        <MenuItem
          disabled={isUndefined(programId)}
          onClick={() => programId && handleCopy(programId)}
        >
          Copy Program ID
        </MenuItem>
        <MenuItem
          disabled={isUndefined(parentId)}
          onClick={() => parentId && handleCopy(parentId)}
        >
          Copy Parent ID
        </MenuItem>
        <MenuItem
          disabled={isUndefined(grandparentId)}
          onClick={() => grandparentId && handleCopy(grandparentId)}
        >
          Copy Grandparent ID
        </MenuItem>
      </Menu>
    </>
  );
};

export const ProgramDebugDetailsMenu = import.meta.env.PROD
  ? () => null // Render nothing in production
  : ProgramDebugDetailsMenuImpl;
