import {
  Badge,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
} from '@mui/material';
import { Link, useRouterState } from '@tanstack/react-router';
import { useNavItems } from '../hooks/useNavItems.tsx';

const getBaseSection = (path: string) => '/' + path.split('/')[1];

export const BottomNavBar = () => {
  const navItems = useNavItems();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const currentSection = getBaseSection(pathname);
  const activeItem = navItems
    .filter((item) => !item.hidden)
    .find((item) => getBaseSection(item.path) === currentSection);

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
          .map((item) => (
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
              component={Link}
              to={item.path}
            />
          ))}
      </BottomNavigation>
    </Paper>
  );
};
