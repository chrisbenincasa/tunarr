import { ExpandLess, ExpandMore, GitHub, Home } from '@mui/icons-material';
import ComputerIcon from '@mui/icons-material/Computer';
import LinkIcon from '@mui/icons-material/Link';
import LiveTvIcon from '@mui/icons-material/LiveTv';
import MoreVert from '@mui/icons-material/MoreVert';
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
  Collapse,
  Divider,
  Drawer,
  IconButton,
  Link,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  MenuProps,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import Container from '@mui/material/Container';
import CssBaseline from '@mui/material/CssBaseline';
import {
  ThemeProvider,
  alpha,
  createTheme,
  styled,
} from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Outlet, Link as RouterLink } from '@tanstack/react-router';
import { isNull, isUndefined } from 'lodash-es';
import React, { ReactNode, useCallback, useMemo, useState } from 'react';
import './App.css';
import TunarrLogo from './components/TunarrLogo.tsx';
import VersionFooter from './components/VersionFooter.tsx';
import DarkModeButton from './components/settings/DarkModeButton.tsx';
import { useServerEventsSnackbar } from './hooks/useServerEvents.ts';
import { useVersion } from './hooks/useVersion.ts';
import useStore from './store/index.ts';
import { useSettings } from './store/settings/selectors.ts';
import { setDarkModeState } from './store/themeEditor/actions.ts';

interface NavItem {
  name: string;
  path: string;
  visible: boolean;
  children?: NavItem[];
  icon?: ReactNode;
}

const StyledMenu = styled((props: MenuProps) => (
  <Menu
    elevation={0}
    anchorOrigin={{
      vertical: 'bottom',
      horizontal: 'right',
    }}
    transformOrigin={{
      vertical: 'top',
      horizontal: 'right',
    }}
    {...props}
  />
))(({ theme }) => ({
  '& .MuiPaper-root': {
    borderRadius: 6,
    marginTop: theme.spacing(1),
    minWidth: 180,
    color:
      theme.palette.mode === 'light'
        ? 'rgb(55, 65, 81)'
        : theme.palette.grey[300],
    boxShadow:
      'rgb(255, 255, 255) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 0px 0px 1px, rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.05) 0px 4px 6px -2px',
    '& .MuiMenu-list': {
      padding: '4px 0',
    },
    '& .MuiMenuItem-root': {
      '& .MuiSvgIcon-root': {
        fontSize: 18,
        color: theme.palette.text.secondary,
        marginRight: theme.spacing(1.5),
      },
      '&:active': {
        backgroundColor: alpha(
          theme.palette.primary.main,
          theme.palette.action.selectedOpacity,
        ),
      },
    },
  },
}));

export function Root({ children }: { children?: React.ReactNode }) {
  useServerEventsSnackbar();
  const [open, setOpen] = useState(false);

  const [sublistStates, setSublistStates] = useState<Record<string, boolean>>(
    {},
  );
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const mobileLinksOpen = !isNull(anchorEl);

  const toggleDrawerOpen = () => {
    setOpen(true);
  };

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const toggleDrawerClosed = () => {
    setOpen(false);
  };

  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const darkMode = useStore((state) => state.theme.darkMode);
  const settings = useSettings();

  const { data: version } = useVersion();

  // Fallback to browser preference if no user selection
  if (isUndefined(darkMode) && prefersDarkMode) {
    setDarkModeState();
  }

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          ...(darkMode
            ? {
                mode: 'dark',
                primary: {
                  main: '#008c93',
                },
                secondary: {
                  main: '#004b79',
                },
                error: {
                  main: '#ab6253',
                },
                warning: {
                  main: '#FF9800',
                },
                info: {
                  main: '#9EA1B3',
                },
                success: {
                  main: '#0A772A',
                },
              }
            : {
                mode: 'light',
                background: {
                  default: '#f5fafc',
                },
                primary: {
                  main: '#008c93',
                },
                secondary: {
                  main: '#004b79',
                },
                error: {
                  main: '#892d22',
                },
                warning: {
                  main: '#FF9800',
                },
                info: {
                  main: '#9EA1B3',
                },
                success: {
                  main: '#0A772A',
                },
              }),
        },
      }),
    [darkMode],
  );

  const smallViewport = useMediaQuery(theme.breakpoints.down('sm'));
  const showWelcome = useStore((state) => state.theme.showWelcome);

  const navItems: NavItem[] = useMemo(
    () => [
      {
        name: 'Welcome',
        path: '/welcome',
        visible: showWelcome,
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
    ],
    [open, showWelcome],
  );

  const Links: NavItem[] = useMemo(
    () => [
      {
        name: 'XMLTV',
        path: `${settings.backendUri}/api/xmltv.xml`,
        visible: true,
        icon: <LinkIcon />,
      },
      {
        name: 'M3U',
        path: `${settings.backendUri}/api/channels.m3u`,
        visible: true,
        icon: <LinkIcon />,
      },
      {
        name: 'GitHub',
        path: 'https://github.com/chrisbenincasa/tunarr',
        visible: true,
        icon: <GitHub />,
      },
      {
        name: 'Documentation',
        path: 'https://tunarr.com/',
        visible: true,
        icon: <TextSnippetIcon />,
      },
    ],
    [settings.backendUri],
  );

  const handleOpenClick = useCallback((itemName: string) => {
    setSublistStates((prev) => ({
      ...prev,
      [itemName]: prev[itemName] ? !prev[itemName] : true,
    }));
  }, []);

  const drawerWidth = open ? 240 : 60;

  return (
    <ThemeProvider theme={theme}>
      {/* <ServerEvents /> */}
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
              to="/"
              component={RouterLink}
            >
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
                to="/guide"
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
                  {Links.map((link) => (
                    <MenuItem
                      disableRipple
                      component={Link}
                      href={link.path}
                      target="_blank"
                      color="inherit"
                      sx={{ px: 1, ml: 0.5 }}
                      key={`mobile-${link.name}`}
                      divider={link.name === 'M3U'}
                    >
                      {link.icon} {link.name}
                    </MenuItem>
                  ))}
                </StyledMenu>
              </>
            ) : (
              Links.map((link) => {
                return link.name === 'XMLTV' || link.name === 'M3U' ? (
                  <Button
                    href={link.path}
                    target="_blank"
                    color="inherit"
                    startIcon={link.icon}
                    sx={{ px: 1, ml: 0.5 }}
                    key={link.name}
                  >
                    {link.name}
                  </Button>
                ) : (
                  <Tooltip title={link.name} key={link.name}>
                    <IconButton
                      href={link.path}
                      target="_blank"
                      color="inherit"
                    >
                      {link.icon}
                    </IconButton>
                  </Tooltip>
                );
              })
            )}
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
              overflowX: 'hidden',
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
              <List
                component="nav"
                sx={{ flex: '1 1 0%', overflowX: 'hidden' }}
              >
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
                          <ListItemIcon
                            sx={{ justifyContent: 'right' }}
                            onClick={() => handleOpenClick(item.name)}
                          >
                            {sublistStates[item.name] ? (
                              <ExpandLess />
                            ) : (
                              <ExpandMore />
                            )}
                          </ListItemIcon>
                        ) : null}
                      </ListItemButton>
                      {item.children ? (
                        <Collapse in={sublistStates[item.name]}>
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
                        </Collapse>
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
                      sx={{ display: 'inline-block' }}
                      color="inherit"
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
