import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import {
  AppBar,
  Box,
  Button,
  Divider,
  Drawer,
  Link,
  List,
  ListItemButton,
  ListItemText,
  Toolbar,
  Typography,
} from '@mui/material';
import Container from '@mui/material/Container';
import CssBaseline from '@mui/material/CssBaseline';
import { useState } from 'react';
import { Outlet, Link as RouterLink } from 'react-router-dom';
import './App.css';

const navItems = [
  { name: 'Guide', path: '/guide', visible: true },
  { name: 'Channels', path: '/channels', visible: true },
  { name: 'Watch', path: '/watch', visible: false },
  { name: 'Settings', path: '/settings/xmltv', visible: true },
];

const drawerWidth = 240;

export function Root() {
  const [open, setOpen] = useState(false);
  const toggleDrawer = () => {
    setOpen(!open);
  };

  return (
    <div>
      <Box sx={{ display: 'flex' }}>
        <CssBaseline />
        <AppBar
          position="absolute"
          sx={{
            width: `calc(100% - ${drawerWidth}px)`,
            ml: `${drawerWidth}px`,
          }}
        >
          <Toolbar>
            <Box flexGrow={1}></Box>
            <Button
              href="/api/xmltv.xml"
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
              sx={{ flexGrow: 1 }}
            >
              DizqueTV
            </Typography>
          </Toolbar>
          <Divider />
          <List component="nav">
            {navItems
              .filter((item) => item.visible)
              .map((item) => (
                <ListItemButton
                  to={item.path}
                  key={item.name}
                  onClick={toggleDrawer}
                  component={RouterLink}
                >
                  <ListItemText primary={item.name} />
                </ListItemButton>
              ))}
            <Divider sx={{ my: 1 }} />
          </List>
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
    </div>
  );
}

function App() {
  return (
    <>
      <Link to={'/channels'} component={RouterLink}>
        Channels
      </Link>
    </>
  );
}

export default App;
