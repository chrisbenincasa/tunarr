import {
  Badge,
  BottomNavigation,
  BottomNavigationAction,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
} from '@mui/material';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { useState } from 'react';
import type { NavItem } from '../hooks/useNavItems.tsx';
import { useNavItems } from '../hooks/useNavItems.tsx';

const getBaseSection = (path: string) => '/' + path.split('/')[1];

export const BottomNavBar = () => {
  const navItems = useNavItems();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [menuAnchor, setMenuAnchor] = useState<{
    el: HTMLElement;
    item: NavItem;
  } | null>(null);

  const currentSection = getBaseSection(pathname);
  const activeItem = navItems
    .filter((item) => !item.hidden)
    .find((item) => getBaseSection(item.path) === currentSection);

  const visibleChildren = (item: NavItem) =>
    item.children?.filter((c) => !c.hidden) ?? [];

  return (
    <Paper
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: (theme) => theme.zIndex.appBar,
      }}
      elevation={3}
    >
      <BottomNavigation value={activeItem?.path ?? false} showLabels>
        {navItems
          .filter((item) => !item.hidden)
          .map((item) => {
            const children = visibleChildren(item);
            const hasChildren = children.length > 0;
            return (
              <BottomNavigationAction
                key={item.name}
                label={item.name}
                value={item.path}
                sx={{ minWidth: 0, flex: 1 }}
                icon={
                  item.badge ? (
                    <Badge
                      badgeContent={item.badge.count}
                      color={item.badge.color}
                    >
                      {item.icon}
                    </Badge>
                  ) : (
                    item.icon
                  )
                }
                {...(hasChildren
                  ? {
                      onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
                        setMenuAnchor({ el: e.currentTarget, item });
                      },
                    }
                  : {
                      component: Link,
                      to: item.path,
                    })}
              />
            );
          })}
      </BottomNavigation>
      <Menu
        open={menuAnchor !== null}
        anchorEl={menuAnchor?.el}
        onClose={() => setMenuAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {menuAnchor && [
          <MenuItem
            key={menuAnchor.item.path}
            selected={pathname === menuAnchor.item.path}
            onClick={() => {
              navigate({ to: menuAnchor.item.path }).catch(console.warn);
              setMenuAnchor(null);
            }}
          >
            {menuAnchor.item.icon && (
              <ListItemIcon>{menuAnchor.item.icon}</ListItemIcon>
            )}
            <ListItemText>{menuAnchor.item.name}</ListItemText>
          </MenuItem>,
          ...visibleChildren(menuAnchor.item).map((child) => (
            <MenuItem
              key={child.path}
              selected={pathname.startsWith(child.path)}
              onClick={() => {
                navigate({ to: child.path }).catch(console.warn);
                setMenuAnchor(null);
              }}
            >
              {child.icon && <ListItemIcon>{child.icon}</ListItemIcon>}
              <ListItemText>{child.name}</ListItemText>
            </MenuItem>
          )),
        ]}
      </Menu>
    </Paper>
  );
};
