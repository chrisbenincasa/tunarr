import { useSettings } from '@/store/settings/selectors.ts';
import { BugReport, OpenInNew } from '@mui/icons-material';
import { IconButton, Link, ListItemIcon, Menu, MenuItem } from '@mui/material';
import type { ChannelProgram } from '@tunarr/types';
import { constant, isUndefined } from 'lodash-es';
import { useState } from 'react';
import { match } from 'ts-pattern';
import { useCopyToClipboard } from 'usehooks-ts';

type Props = {
  program: ChannelProgram;
};

const defaultUndefined = constant(undefined);

// eslint-disable-next-line react-refresh/only-export-components
const ProgramDebugDetailsMenuImpl = ({ program }: Props) => {
  const { backendUri } = useSettings();
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [, copyToClipboard] = useCopyToClipboard();

  const programId = match(program)
    .with({ type: 'content' }, (p) => p.id)
    .with({ type: 'custom' }, (p) => p.id)
    .otherwise(defaultUndefined);

  const parentId = match(program)
    .with({ type: 'content' }, (p) => p.seasonId ?? p.albumId)
    .with({ type: 'custom' }, (p) => p.program?.seasonId ?? p.program?.albumId)
    .otherwise(defaultUndefined);

  const grandparentId = match(program)
    .with({ type: 'content' }, (p) => p.showId ?? p.artistId)
    .with({ type: 'custom' }, (p) => p.program?.showId ?? p.program?.artistId)
    .otherwise(defaultUndefined);

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
