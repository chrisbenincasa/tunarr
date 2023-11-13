import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import MenuIcon from '@mui/icons-material/Menu';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import {
  AppBar,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
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

export function Root() {
  const [open, setOpen] = useState(false);
  const toggleDrawer = () => {
    setOpen(!open);
  };

  return (
    <div>
      <Box sx={{ display: 'flex' }}>
        <CssBaseline />

        <AppBar position="absolute">
          <Toolbar>
            <IconButton
              size="large"
              edge="start"
              color="inherit"
              sx={{ mr: 2 }}
              onClick={toggleDrawer}
            >
              <MenuIcon />
            </IconButton>
            <Typography
              variant="h6"
              component="h1"
              noWrap
              color="inherit"
              sx={{ flexGrow: 1 }}
            >
              DizqueTV
            </Typography>
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
        <Drawer open={open}>
          <Box sx={{ width: 250 }} role="presentation">
            <Toolbar
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                px: [1],
              }}
            >
              <IconButton onClick={toggleDrawer}>
                <ChevronLeftIcon />
              </IconButton>
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
              {/* {secondaryListItems} */}
            </List>
          </Box>
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
