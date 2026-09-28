import { useIsDarkMode } from '@/hooks/useTunarrTheme.ts';
import { t } from '@lingui/core/macro';
import { ExpandLess, ExpandMore } from '@mui/icons-material';
import {
  Badge,
  Box,
  Collapse,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Drawer as MuiDrawer,
  Toolbar,
} from '@mui/material';
import { useNavigate } from '@tanstack/react-router';
import React, { useCallback, useRef, useState } from 'react';
import type { NavItem } from '../hooks/useNavItems.tsx';
import { useNavItems } from '../hooks/useNavItems.tsx';
import VersionFooter from './VersionFooter.tsx';

const DrawerWidth = 240;

type ItemProps = {
  item: NavItem;
};

const DrawerItem = ({ item }: ItemProps) => {
  const navigate = useNavigate();

  const isChildSelected =
    item.children?.some((child) => child.selected) ?? false;

  const hasDisplayableChildren =
    item.children?.some((child) => !child.hidden) ?? false;

  const [sublistOpen, setSublistOpen] = useState(isChildSelected);

  const handleItemClick = useCallback(
    (path: string | undefined) => {
      if (path) {
        // Show the children of the section being navigated to, but never
        // collapse them; the chevron button handles collapsing.
        setSublistOpen(true);
        navigate({ to: path }).catch(console.warn);
      } else {
        setSublistOpen((prev) => !prev);
      }
    },
    [navigate],
  );

  const handleChildClick = useCallback(
    (path: string | undefined) => {
      if (path) {
        navigate({ to: path }).catch(console.warn);
      }
    },
    [navigate],
  );

  return (
    <React.Fragment key={item.name}>
      <ListItem
        disablePadding
        secondaryAction={
          item.children && hasDisplayableChildren ? (
            <IconButton
              edge="end"
              aria-label={
                sublistOpen ? t`Collapse ${item.name}` : t`Expand ${item.name}`
              }
              aria-expanded={sublistOpen}
              onClick={() => setSublistOpen((prev) => !prev)}
            >
              {sublistOpen ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          ) : undefined
        }
      >
        <ListItemButton
          selected={item.selected || isChildSelected}
          onClick={() => handleItemClick(item.path)}
        >
          {item.icon && item.badge && !sublistOpen ? (
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
        </ListItemButton>
      </ListItem>
      {item.children && hasDisplayableChildren ? (
        <Collapse in={sublistOpen} timeout={100}>
          <List component="div" disablePadding>
            {item.children
              .filter((item) => !item.hidden)
              .map((child) => (
                <ListItemButton
                  key={child.name}
                  sx={{ pl: 4 }}
                  selected={child.selected}
                  onClick={() => handleChildClick(child.path)}
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

export const Drawer = () => {
  const drawerRef = useRef(null);
  const navItems = useNavItems();
  const darkMode = useIsDarkMode();

  return (
    <MuiDrawer
      ref={drawerRef}
      sx={{
        width: DrawerWidth,
        flex: '0 0 auto',
        '& .MuiDrawer-paper': {
          width: DrawerWidth,
        },
        boxSizing: 'border-box',
        p: 0,
      }}
      slotProps={{
        paper: {
          elevation: 4,
          sx: {
            boxShadow: 'none',
            borderRight: darkMode ? 'none' : '1px solid rgba(0, 0, 0, 0.12)',
          },
        },
      }}
      variant="permanent"
      anchor="left"
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
        {/* The list grows to push the footer to the bottom but never shrinks,
            so when every section is open the drawer scrolls as a whole
            instead of clipping links behind the footer. */}
        <List component="nav" sx={{ flex: '1 0 auto', overflowX: 'hidden' }}>
          {navItems
            .filter((item) => !item.hidden)
            .map((item) => (
              <DrawerItem key={item.name} item={item} />
            ))}
          <Divider sx={{ my: 1 }} />
        </List>
        <Box sx={{ whiteSpace: 'nowrap', overflow: 'hidden', flexShrink: 0 }}>
          <VersionFooter />
        </Box>
      </>
    </MuiDrawer>
  );
};
