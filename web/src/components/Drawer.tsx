import { ExpandLess, ExpandMore } from '@mui/icons-material';
import {
  Badge,
  Box,
  Collapse,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Drawer as MuiDrawer,
  Toolbar,
} from '@mui/material';
import { Link as RouterLink } from '@tanstack/react-router';
import { useToggle } from '@uidotdev/usehooks';
import { Transition } from 'notistack';
import React, { useCallback, useRef, useState } from 'react';
import type { NavItem } from '../hooks/useNavItems.tsx';
import { useNavItems } from '../hooks/useNavItems.tsx';
import VersionFooter from './VersionFooter.tsx';

export const DrawerClosedWidth = 60;
export const DrawerOpenWidth = 240;

export type DrawerTransitionState = 'opening' | 'open' | 'closing' | 'closed';

type Props = {
  onOpen?: () => void;
  onClose?: () => void;
};

type ItemProps = {
  item: NavItem;
  drawerState: DrawerTransitionState;
};

const DrawerItem = ({ item, drawerState }: ItemProps) => {
  const [sublistOpen, setSublistOpen] = useState(false);

  const childIn =
    (drawerState === 'open' || drawerState === 'opening') &&
    (sublistOpen || item.selected);

  const handleOpenClick = useCallback((ev: React.MouseEvent) => {
    ev.preventDefault();
    ev.stopPropagation();
    setSublistOpen((prev) => !prev);
  }, []);

  return (
    <React.Fragment key={item.name}>
      <ListItemButton
        to={item.path}
        key={item.name}
        component={RouterLink}
        selected={item.selected}
      >
        {item.icon && item.badge && !childIn ? (
          <Badge
            badgeContent={item.badge.count}
            color={item.badge.color}
            sx={{
              '& .MuiBadge-badge': {
                right: '20px',
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 45 }}>{item.icon}</ListItemIcon>
          </Badge>
        ) : (
          <ListItemIcon sx={{ minWidth: 45 }}>{item.icon}</ListItemIcon>
        )}
        <ListItemText primary={item.name} />
        {item.children && !item.selected ? (
          <ListItemIcon
            sx={{ justifyContent: 'right' }}
            onClick={handleOpenClick}
          >
            {sublistOpen ? <ExpandLess /> : <ExpandMore />}
          </ListItemIcon>
        ) : null}
      </ListItemButton>
      {item.children ? (
        <Collapse in={childIn} timeout={100}>
          <List component="div" disablePadding>
            {item.children
              .filter((item) => !item.hidden)
              .map((child) => (
                <ListItemButton
                  key={child.name}
                  to={child.path}
                  sx={{ pl: 4 }}
                  component={RouterLink}
                  selected={child.selected}
                >
                  {child.icon && child.badge ? (
                    <Badge
                      badgeContent={child.badge.count}
                      color={child.badge.color}
                      sx={{
                        '& .MuiBadge-badge': {
                          right: '20px',
                        },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 45 }}>
                        {child.icon}
                      </ListItemIcon>
                    </Badge>
                  ) : (
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
  );
};

export const Drawer = ({ onOpen, onClose }: Props) => {
  const [drawerOpen, toggleDrawerOpen] = useToggle(false);
  const [drawerState, setDrawerState] =
    useState<DrawerTransitionState>('closed');
  const drawerRef = useRef(null);

  const navItems = useNavItems();

  const handleStateChange = (state: DrawerTransitionState) => {
    setDrawerState(state);
    switch (state) {
      case 'open':
        onOpen?.();
        break;
      case 'closed':
        onClose?.();
        break;
      case 'closing':
        break;
      default:
        break;
    }
  };

  return (
    <Transition
      nodeRef={drawerRef}
      in={drawerOpen}
      timeout={300}
      onEnter={() => handleStateChange('opening')}
      onEntered={() => handleStateChange('open')}
      onExiting={() => handleStateChange('closing')}
      onExited={() => handleStateChange('closed')}
    >
      {(state) => (
        <MuiDrawer
          ref={drawerRef}
          sx={{
            width:
              state === 'entered' || state === 'entering'
                ? DrawerOpenWidth
                : DrawerClosedWidth,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width:
                state === 'entered' || state === 'entering'
                  ? DrawerOpenWidth
                  : DrawerClosedWidth,
              boxSizing: 'border-box',
              p: 0,
              transition: (theme) =>
                theme.transitions.create('width', {
                  easing: 'cubic-bezier(0.4,0,0.2,1)',
                  duration: '.15s',
                }),
            },
            WebkitTransitionDuration: '.15s',
            WebkitTransitionTimingFunction: 'cubic-bezier(0.4,0,0.2,1)',
            overflowX: 'hidden',
            position: 'absolute',
          }}
          PaperProps={{
            elevation: 4,
          }}
          variant="permanent"
          anchor="left"
          onMouseEnter={() => toggleDrawerOpen(true)}
          onMouseLeave={() => toggleDrawerOpen(false)}
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
            <List component="nav" sx={{ flex: '1 1 0%', overflowX: 'hidden' }}>
              {navItems
                .filter((item) => !item.hidden)
                .map((item) => (
                  <DrawerItem item={item} drawerState={drawerState} />
                ))}
              <Divider sx={{ my: 1 }} />
            </List>
            {(drawerState === 'open' || drawerState === 'opening') && (
              <Box sx={{ whiteSpace: 'nowrap', overflow: 'hidden' }}>
                <VersionFooter />
              </Box>
            )}
          </>
        </MuiDrawer>
      )}
    </Transition>
  );
};
