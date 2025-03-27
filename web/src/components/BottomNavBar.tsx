import { AppBar, IconButton, Toolbar } from '@mui/material';
import { Link } from '@tanstack/react-router';
import React from 'react';
import { useNavItems } from '../hooks/useNavItems.tsx';

export const BottomNavBar = () => {
  const navItems = useNavItems();

  return (
    <AppBar position="fixed" sx={{ top: 'auto', bottom: 0 }}>
      <Toolbar sx={{ display: 'flex', justifyContent: 'space-around' }}>
        {navItems
          .filter((item) => !item.hidden)
          .map((item) => (
            <React.Fragment key={item.name}>
              <IconButton
                to={item.path}
                key={item.name}
                component={Link}
                sx={{ display: 'inline-block' }}
                color="inherit"
              >
                {item.icon}
              </IconButton>
            </React.Fragment>
          ))}
      </Toolbar>
    </AppBar>
  );
};
