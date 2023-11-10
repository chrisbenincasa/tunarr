import MenuIcon from '@mui/icons-material/Menu';
import {
  AppBar,
  Box,
  Button,
  IconButton,
  Toolbar,
  Typography,
} from '@mui/material';
import Container from '@mui/material/Container';
import CssBaseline from '@mui/material/CssBaseline';
import { useQuery } from '@tanstack/react-query';
import { Outlet } from '@tanstack/react-router';
import { useState } from 'react';
import './App.css';
import LinkRouter from './components/LinkRouter';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';

export function Root() {
  const [_, setOpen] = useState(true);
  const toggleDrawer = () => {
    setOpen(!true);
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
  return <LinkRouter to="/channels">Channels</LinkRouter>;
}

export default App;
