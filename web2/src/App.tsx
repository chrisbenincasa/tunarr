import { ThemeProvider } from '@mui/material/styles';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import {
  AppBar,
  Box,
  Button,
  Divider,
  Drawer,
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
import React, { ReactNode, useState } from 'react';
import { Outlet, Link as RouterLink } from 'react-router-dom';
import './App.css';
import ServerEvents from './components/ServerEvents.tsx';
import VersionFooter from './components/VersionFooter.tsx';
import SettingsIcon from '@mui/icons-material/Settings';
import LiveTvIcon from '@mui/icons-material/LiveTv';
import SettingsRemoteIcon from '@mui/icons-material/SettingsRemote';
import TvIcon from '@mui/icons-material/Tv';
import PreviewIcon from '@mui/icons-material/Preview';
import TheatersIcon from '@mui/icons-material/Theaters';
import theme from './theme.tsx';
interface NavItem {
  name: string;
  path: string;
  visible: boolean;
  children?: NavItem[];
  icon?: ReactNode;
}

const navItems: NavItem[] = [
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
        path: '/library/filler',
        visible: true,
        icon: <PreviewIcon />,
      },
      {
        name: 'Custom Shows',
        path: '/library/custom-shows',
        visible: true,
        icon: <TheatersIcon />,
      },
    ],
  },
  {
    name: 'Settings',
    path: '/settings/xmltv',
    visible: true,
    icon: <SettingsIcon />,
  },
];

const drawerWidth = 240;

export function Root() {
  const [open, setOpen] = useState(false);
  const toggleDrawer = () => {
    setOpen(!open);
  };

  return (
    <ThemeProvider theme={theme}>
      <ServerEvents />
      <Box sx={{ display: 'flex' }}>
        <CssBaseline />
        <AppBar
          position="absolute"
          sx={{
            width: `calc(100% - ${drawerWidth}px)`,
            ml: `${drawerWidth}px`,
            p: 0,
          }}
        >
          <Toolbar>
            <Box flexGrow={1}></Box>
            <Button
              href="http://localhost:8000/api/xmltv.xml"
              color="inherit"
              startIcon={<TextSnippetIcon />}
            >
              XMLTV
            </Button>
            <Button
              href="/api/channels.m3u"
              color="inherit"
              startIcon={<TextSnippetIcon />}
            >
              M3U
            </Button>
          </Toolbar>
        </AppBar>
        <Drawer
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
              p: 0,
            },
          }}
          variant="permanent"
          anchor="left"
        >
          <Toolbar
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              px: [1],
            }}
          >
            <img
              style={{ width: '2rem', height: '2rem' }}
              src="/dizquetv.png"
            />
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
                DizqueTV
              </Link>
            </Typography>
          </Toolbar>
          <Divider />
          <List component="nav" sx={{ flex: '1 1 0%' }}>
            {navItems
              .filter((item) => item.visible)
              .map((item) => (
                <React.Fragment key={item.name}>
                  <ListItemButton
                    to={item.path}
                    key={item.name}
                    onClick={toggleDrawer}
                    component={RouterLink}
                  >
                    {item.icon && <ListItemIcon>{item.icon}</ListItemIcon>}
                    <ListItemText primary={item.name} />
                  </ListItemButton>
                  {item.children ? (
                    <List component="div" disablePadding>
                      {item.children.map((child) => (
                        <ListItemButton
                          key={child.name}
                          to={child.path}
                          sx={{ pl: 4 }}
                          onClick={toggleDrawer}
                          component={RouterLink}
                        >
                          {child.icon && (
                            <ListItemIcon>{child.icon}</ListItemIcon>
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
          <VersionFooter />
        </Drawer>
        <Box
          component="main"
          sx={{
            backgroundColor: (theme) =>
              theme.palette.mode === 'light'
                ? theme.palette.grey[100]
                : theme.palette.grey[900],
            flexGrow: 1,
            height: '100vh',
            overflow: 'auto',
          }}
        >
          <Toolbar />
          <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
            <Outlet />
          </Container>
        </Box>
      </Box>
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
