import MenuIcon from '@mui/icons-material/Menu';
import {
  AppBar,
  Box,
  IconButton,
  Link,
  Toolbar,
  Typography,
} from '@mui/material';
import Container from '@mui/material/Container';
import CssBaseline from '@mui/material/CssBaseline';
import { useQuery } from '@tanstack/react-query';
import { Outlet, Link as RouteLink } from '@tanstack/react-router';
import { useState } from 'react';
import './App.css';
import LinkRouter from './components/LinkRouter.tsx';

export function Root() {
  return (
    <>
      <div>
        <LinkRouter to={'/'}>Home</LinkRouter>
        <LinkRouter to="/channels">Channels</LinkRouter>
        <Outlet />
      </div>
    </>
  );
}

function App() {
  const [_, setOpen] = useState(true);
  const toggleDrawer = () => {
    setOpen(!true);
  };
  const { isPending, error, data } = useQuery({
    queryKey: ['test'],
    queryFn: () =>
      fetch('http://localhost:8000/api/channels').then((res) => res.json()),
  });

  if (isPending) return 'Loading...';

  if (error) return 'An error occurred!: ' + error.message;

  console.log(data);

  return (
    <>
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
          </Toolbar>
        </AppBar>
        <Container>
          <Link component={RouteLink} to={'/channels'}>
            Test
          </Link>
        </Container>
      </Box>
    </>
  );
}

export default App;
