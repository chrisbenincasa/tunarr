import DiscordIcon from '@/assets/icon_clyde_black_RGB.svg?react';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard.ts';
import { GitHub } from '@mui/icons-material';
import LinkIcon from '@mui/icons-material/Link';
import MoreVert from '@mui/icons-material/MoreVert';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import {
  Alert,
  AppBar,
  Box,
  Button,
  IconButton,
  Link,
  MenuItem,
  SvgIcon,
  Toolbar,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import Container from '@mui/material/Container';
import CssBaseline from '@mui/material/CssBaseline';
import useMediaQuery from '@mui/material/useMediaQuery';
import { Outlet, Link as RouterLink } from '@tanstack/react-router';
import { isEmpty, isNull } from 'lodash-es';
import React, { useCallback, useMemo, useState } from 'react';
import './App.css';
import { BottomNavBar } from './components/BottomNavBar.tsx';
import { Drawer } from './components/Drawer.tsx';
import TunarrLogo from './components/TunarrLogo.tsx';
import { StyledMenu } from './components/base/StyledMenu.tsx';
import DarkModeButton from './components/settings/DarkModeButton.tsx';
import { type NavItem } from './hooks/useNavItems.ts';
import { useServerEventsSnackbar } from './hooks/useServerEvents.ts';
import { useVersion } from './hooks/useVersion.tsx';
import { useSettings } from './store/settings/selectors.ts';
import { strings } from './strings.ts';

export function Root({ children }: { children?: React.ReactNode }) {
  useServerEventsSnackbar();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const mobileLinksOpen = !isNull(anchorEl);
  const copyToClipboard = useCopyToClipboard();

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const settings = useSettings();

  const { data: version } = useVersion();

  const theme = useTheme();

  const smallViewport = useMediaQuery(theme.breakpoints.down('sm'));

  const actualBackendUri = isEmpty(settings.backendUri)
    ? window.location.origin
    : settings.backendUri;

  const handleNavItemLinkClick = useCallback(
    (e: React.SyntheticEvent, navItem: NavItem) => {
      if (navItem.copyToClipboard) {
        e.preventDefault();
        copyToClipboard(
          navItem.path,
          `Copied ${navItem.name} URL to clipboard`,
        ).catch(console.error);
      }
    },
    [copyToClipboard],
  );

  const TopBarLinks: NavItem[] = useMemo(
    () => [
      {
        name: 'XMLTV',
        path: `${actualBackendUri}/api/xmltv.xml`,
        visible: true,
        icon: <LinkIcon />,
        copyToClipboard: true,
      },
      {
        name: 'M3U',
        path: `${actualBackendUri}/api/channels.m3u`,
        visible: true,
        icon: <LinkIcon />,
        copyToClipboard: true,
      },
      {
        name: 'GitHub',
        path: 'https://github.com/chrisbenincasa/tunarr',
        visible: true,
        icon: <GitHub />,
      },
      {
        name: 'Discord',
        path: 'https://discord.gg/svgSBYkEK5',
        visible: true,
        icon: (
          <SvgIcon>
            <DiscordIcon />
          </SvgIcon>
        ),
      },
      {
        name: 'Documentation',
        path: 'https://tunarr.com/',
        visible: true,
        icon: <TextSnippetIcon />,
      },
    ],
    [actualBackendUri],
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />

      <AppBar
        position="fixed"
        sx={{
          p: 0,
          zIndex: theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar>
          <Link underline="none" color="inherit" to="/" component={RouterLink}>
            <TunarrLogo style={{ marginTop: '0.4em', width: '40px' }} />
          </Link>
          <Typography
            variant="h6"
            component="h1"
            noWrap
            color="inherit"
            sx={{ flexGrow: 1, pl: 1 }}
          >
            <Link
              underline="none"
              color="inherit"
              to="/"
              component={RouterLink}
            >
              Tunarr
            </Link>
          </Typography>
          <Box flexGrow={1}></Box>
          <DarkModeButton iconOnly />
          {smallViewport ? (
            <>
              <Button onClick={handleClick} color="inherit">
                <MoreVert />
              </Button>
              <StyledMenu
                MenuListProps={{
                  'aria-labelledby': 'demo-customized-button',
                }}
                anchorEl={anchorEl}
                open={mobileLinksOpen}
                onClose={handleClose}
              >
                {TopBarLinks.map((link) => (
                  <MenuItem
                    disableRipple
                    component={Link}
                    href={link.path}
                    target="_blank"
                    color="inherit"
                    sx={{ px: 1, ml: 0.5 }}
                    key={`mobile-${link.name}`}
                    divider={link.name === 'M3U'}
                    onClick={(e) => handleNavItemLinkClick(e, link)}
                  >
                    {link.icon} {link.name}
                  </MenuItem>
                ))}
              </StyledMenu>
            </>
          ) : (
            TopBarLinks.map((link) => {
              return link.name === 'XMLTV' || link.name === 'M3U' ? (
                <Button
                  href={link.path}
                  target="_blank"
                  color="inherit"
                  startIcon={link.icon}
                  sx={{ px: 1, ml: 0.5 }}
                  key={link.name}
                  onClick={(e) => handleNavItemLinkClick(e, link)}
                >
                  {link.name}
                </Button>
              ) : (
                <Tooltip title={link.name} key={link.name}>
                  <IconButton href={link.path} target="_blank" color="inherit">
                    {link.icon}
                  </IconButton>
                </Tooltip>
              );
            })
          )}
        </Toolbar>
      </AppBar>
      {!smallViewport ? <Drawer /> : <BottomNavBar />}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          // height: '100vh', // Uncommenting this breaks any use of scrollTo()
          // overflow: 'auto', // Commenting out to support position: sticky
          ml: [undefined, '60px'],
        }}
      >
        <Toolbar />
        <Container
          disableGutters
          maxWidth="xl"
          sx={{ mt: 4, mb: 4, pl: 5, pr: 5, maxWidth: 'calc(100vw - 80px)' }}
        >
          {version?.ffmpeg === 'unknown' ? (
            <Alert
              variant="filled"
              severity="error"
              sx={{ my: 2, display: 'flex', flexGrow: 1, width: '100%' }}
              action={
                <Button
                  to={'/settings/ffmpeg'}
                  component={RouterLink}
                  variant="outlined"
                  sx={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    color: theme.palette.common.white,
                  }}
                >
                  Update Path
                </Button>
              }
            >
              {strings.FFMPEG_MISSING}
            </Alert>
          ) : null}
          {children ?? <Outlet />}
        </Container>
      </Box>
    </Box>
  );
}

export default function App() {
  return (
    <>
      <Link to={'/channels'} component={RouterLink}>
        Channels
      </Link>
    </>
  );
}
