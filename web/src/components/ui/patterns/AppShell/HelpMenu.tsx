import DiscordIcon from '@/assets/icon_clyde_black_RGB.svg?react';
import { Trans, useLingui } from '@lingui/react/macro';
import {
  ContentCopy,
  GitHub,
  HelpOutline,
  TextSnippet,
} from '@mui/icons-material';
import {
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  SvgIcon,
  Tooltip,
} from '@mui/material';
import { useId, useState } from 'react';
import { ShellIconButton, type ShellIconButtonVariant } from './shellLinks.ts';

export type HelpMenuVersion =
  | { state: 'loading' }
  | { state: 'error' }
  | { state: 'loaded'; tunarr: string; ffmpeg: string };

export type HelpMenuProps = {
  version: HelpMenuVersion;
  onCopyXmlTvUrl: () => void;
  onCopyM3uUrl: () => void;
  variant?: ShellIconButtonVariant;
};

const externalLinks = [
  { key: 'docs', href: 'https://tunarr.com/', icon: <TextSnippet /> },
  {
    key: 'github',
    href: 'https://github.com/chrisbenincasa/tunarr',
    icon: <GitHub />,
  },
  {
    key: 'discord',
    href: 'https://discord.gg/svgSBYkEK5',
    icon: (
      <SvgIcon>
        <DiscordIcon />
      </SvgIcon>
    ),
  },
] as const;

export const HelpMenu = ({
  version,
  onCopyXmlTvUrl,
  onCopyM3uUrl,
  variant,
}: HelpMenuProps) => {
  const { t } = useLingui();
  const menuId = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = () => setAnchor(null);

  const linkLabels = {
    docs: t`Documentation`,
    github: 'GitHub',
    discord: 'Discord',
  };

  return (
    <>
      <Tooltip title={t`Help and links`}>
        <ShellIconButton
          variant={variant}
          aria-label={t`Help and links`}
          aria-haspopup="menu"
          aria-controls={anchor ? menuId : undefined}
          aria-expanded={anchor ? 'true' : undefined}
          onClick={(e) => setAnchor(e.currentTarget)}
        >
          <HelpOutline />
        </ShellIconButton>
      </Tooltip>
      <Menu
        id={menuId}
        anchorEl={anchor}
        open={anchor !== null}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 240, mt: 1 } } }}
      >
        <MenuItem
          onClick={() => {
            onCopyXmlTvUrl();
            close();
          }}
        >
          <ListItemIcon>
            <ContentCopy fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            <Trans>Copy XMLTV URL</Trans>
          </ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            onCopyM3uUrl();
            close();
          }}
        >
          <ListItemIcon>
            <ContentCopy fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            <Trans>Copy M3U URL</Trans>
          </ListItemText>
        </MenuItem>
        <Divider />
        {externalLinks.map((link) => (
          <MenuItem
            key={link.key}
            component="a"
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={close}
          >
            <ListItemIcon>{link.icon}</ListItemIcon>
            <ListItemText>{linkLabels[link.key]}</ListItemText>
          </MenuItem>
        ))}
        <Divider />
        <MenuItem disabled sx={{ '&.Mui-disabled': { opacity: 1 } }}>
          <ListItemText
            slotProps={{
              primary: { variant: 'mono', color: 'text.secondary' },
              secondary: { variant: 'mono' },
            }}
            primary={
              version.state === 'loaded' ? (
                <Trans>Tunarr {version.tunarr}</Trans>
              ) : version.state === 'error' ? (
                <Trans>Version unknown</Trans>
              ) : (
                <Trans>Loading version…</Trans>
              )
            }
            secondary={
              version.state === 'loaded' ? (
                <Trans>FFmpeg {version.ffmpeg}</Trans>
              ) : undefined
            }
          />
        </MenuItem>
      </Menu>
    </>
  );
};
