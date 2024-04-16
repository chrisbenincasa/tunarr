import { ExpandMore, GitHub, Home } from '@mui/icons-material';
import ComputerIcon from '@mui/icons-material/Computer';
import LiveTvIcon from '@mui/icons-material/LiveTv';
import PreviewIcon from '@mui/icons-material/Preview';
import SettingsIcon from '@mui/icons-material/Settings';
import SettingsRemoteIcon from '@mui/icons-material/SettingsRemote';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import TheatersIcon from '@mui/icons-material/Theaters';
import TvIcon from '@mui/icons-material/Tv';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import {
  Alert,
  AppBar,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  Link,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from '@mui/material';
import Container from '@mui/material/Container';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { isUndefined } from 'lodash-es';
import React, { ReactNode, useState } from 'react';
import { Outlet, Link as RouterLink } from 'react-router-dom';
import './App.css';
import ServerEvents from './components/ServerEvents.tsx';
import TunarrLogo from './components/TunarrLogo.tsx';
import VersionFooter from './components/VersionFooter.tsx';
import DarkModeButton from './components/settings/DarkModeButton.tsx';
import { useVersion } from './hooks/useVersion.ts';
import useStore from './store/index.ts';
import { setDarkModeState } from './store/themeEditor/actions.ts';

interface NavItem {
  name: string;
  path: string;
  visible: boolean;
  children?: NavItem[];
  icon?: ReactNode;
}

export function Root({ children }: { children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  const toggleDrawerOpen = () => {
    setOpen(true);
  };

  const toggleDrawerClosed = () => {
    setOpen(false);
  };

  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const darkMode = useStore((state) => state.theme.darkMode);

  const { data: version } = useVersion();

  // Fallback to browser preference if no user selection
  if (isUndefined(darkMode) && prefersDarkMode) {
    setDarkModeState();
  }

  const theme = React.useMemo(
    () =>
      createTheme({
        palette: {
          background: {
            default: darkMode ? '#212121' : '#f5f5f5',
          },
          mode: darkMode ? 'dark' : 'light',
          primary: {
            main: 'rgb(241, 93, 85)',
          },
          secondary: {
            main: 'rgb(0, 125, 184)',
          },
          info: {
            main: 'rgb(147, 168, 172)',
          },
        },
      }),
    [darkMode],
  );

  const smallViewport = useMediaQuery(theme.breakpoints.down('sm'));
  const pathway = useStore((state) => state.theme.pathway);

  const navItems: NavItem[] = [
    {
      name: 'Welcome',
      path: '/welcome',
      visible: pathway === 'advanced' ? false : true,
      icon: <Home />,
    },
    { name: 'Guide', path: '/guide', visible: true, icon: <TvIcon /> },
    {
      name: 'Channels',
      path: '/channels',
      visible: true,
      icon: <SettingsRemoteIcon />,
    },
    { name: 'Watch', path: '/watch', visible: false, icon: <LiveTvIcon /> },
    {
      name: 'Library',
      path: '/library',
      visible: true,
      icon: <VideoLibraryIcon />,
      children: [
        {
          name: 'Filler Lists',
          path: '/library/fillers',
          visible: open,
          icon: <PreviewIcon />,
        },
        {
          name: 'Custom Shows',
          path: '/library/custom-shows',
          visible: open,
          icon: <TheatersIcon />,
        },
      ],
    },
    {
      name: 'Settings',
      path: '/settings/general',
      visible: true,
      icon: <SettingsIcon />,
    },
    {
      name: 'System',
      path: '/system',
      visible: false, // TODO
      icon: <ComputerIcon />,
    },
  ];

  const drawerWidth = open ? 240 : 60;

  return (
    <ThemeProvider theme={theme}>
      <ServerEvents />
      <Box sx={{ display: 'flex' }}>
        <CssBaseline />
        <AppBar
          position="fixed"
          sx={{
            ml: `${drawerWidth}px`,
            p: 0,
            zIndex: theme.zIndex.drawer + 1,
          }}
        >
          <Toolbar>
            <Link
              underline="none"
              color="inherit"
              to="/guide"
              component={RouterLink}
            >
              <TunarrLogo style={{ marginTop: '0.4em', maxHeight: '40px' }} />
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
                to="/guide"
                component={RouterLink}
              >
                Tunarr
              </Link>
            </Typography>
            <Box flexGrow={1}></Box>
            <DarkModeButton iconOnly />
            <IconButton
              href="https://github.com/chrisbenincasa/tunarr"
              target="_blank"
              color="inherit"
            >
              <GitHub />
            </IconButton>
            <Button
              href="//localhost:8000/api/xmltv.xml"
              target="_blank"
              color="inherit"
              startIcon={<TextSnippetIcon />}
              sx={{ px: 1, ml: 0.5 }}
            >
              XMLTV
            </Button>
            <Button
              href="//localhost:8000/api/channels.m3u"
              target="_blank"
              color="inherit"
              startIcon={<TextSnippetIcon />}
              sx={{ px: 1, ml: 0.5 }}
            >
              M3U
            </Button>
          </Toolbar>
        </AppBar>
        {!smallViewport ? (
          <Drawer
            sx={{
              width: drawerWidth,
              flexShrink: 0,
              '& .MuiDrawer-paper': {
                width: drawerWidth,
                boxSizing: 'border-box',
                p: 0,
              },
              WebkitTransitionDuration: '.15s',
              WebkitTransitionTimingFunction: 'cubic-bezier(0.4,0,0.2,1)',
            }}
            variant="permanent"
            anchor="left"
            onMouseEnter={toggleDrawerOpen}
            onMouseLeave={toggleDrawerClosed}
          >
            <>
              <Toolbar
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  px: [1],
                }}
              ></Toolbar>
              <Divider />
              <List component="nav" sx={{ flex: '1 1 0%' }}>
                {navItems
                  .filter((item) => item.visible)
                  .map((item) => (
                    <React.Fragment key={item.name}>
                      <ListItemButton
                        to={item.path}
                        key={item.name}
                        component={RouterLink}
                      >
                        {item.icon && (
                          <ListItemIcon sx={{ minWidth: 45 }}>
                            {item.icon}
                          </ListItemIcon>
                        )}
                        <ListItemText primary={item.name} />
                        {item.children ? (
                          <ListItemIcon sx={{ justifyContent: 'right' }}>
                            <ExpandMore />
                          </ListItemIcon>
                        ) : null}
                      </ListItemButton>
                      {item.children ? (
                        <List component="div" disablePadding>
                          {item.children
                            .filter((item) => item.visible)
                            .map((child) => (
                              <ListItemButton
                                key={child.name}
                                to={child.path}
                                sx={{ pl: 4 }}
                                component={RouterLink}
                              >
                                {child.icon && (
                                  <ListItemIcon sx={{ minWidth: 45 }}>
                                    {child.icon}
                                  </ListItemIcon>
                                )}
                                <ListItemText primary={child.name} />
                              </ListItemButton>
                            ))}
                        </List>
                      ) : null}
                    </React.Fragment>
                  ))}
                <Divider sx={{ my: 1 }} />
              </List>
              {!open || <VersionFooter />}
            </>
          </Drawer>
        ) : (
          <AppBar position="fixed" sx={{ top: 'auto', bottom: 0 }}>
            <Toolbar sx={{ display: 'flex', justifyContent: 'space-around' }}>
              {navItems
                .filter((item) => item.visible)
                .map((item) => (
                  <React.Fragment key={item.name}>
                    <IconButton
                      to={item.path}
                      key={item.name}
                      component={RouterLink}
                      sx={{ display: 'inline-block', color: '#fff' }}
                    >
                      {item.icon}
                    </IconButton>
                  </React.Fragment>
                ))}
            </Toolbar>
          </AppBar>
        )}
        <Box
          component="main"
          sx={{
            backgroundColor: (theme) =>
              theme.palette.mode === 'light'
                ? theme.palette.grey[100]
                : theme.palette.grey[900],
            flexGrow: 1,
            // height: '100vh', // Uncommenting this breaks any use of scrollTo()
            overflow: 'auto',
          }}
        >
          <Toolbar />
          <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
            {version?.ffmpeg === 'Error' ? (
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
                FFMPEG not found. For all features to work, we recommend
                installing FFMPEG 4.2+ or update your FFMPEG executable path in
                settings.
              </Alert>
            ) : null}
            {children ?? <Outlet />}
          </Container>
        </Box>
      </Box>
      <ReactQueryDevtools initialIsOpen={false} />
    </ThemeProvider>
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
